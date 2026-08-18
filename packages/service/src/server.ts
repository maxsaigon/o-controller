import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { z } from 'zod';
import {
  COMMANDS,
  buildVolumeCommand,
  buildInputCommand,
} from '@o-control/eiscp';
import type { ParsedPacket } from '@o-control/eiscp';
import {
  INPUT_CODES,
  type InputId,
  type OControlEvent,
  type PlaybackCommand,
  PLAYBACK_CODES,
} from '@o-control/shared';
import { loadConfig } from './config.js';
import { StateStore } from './state-store.js';
import { ReceiverClient } from './receiver-client.js';
import { findPreset, loadPresets } from './presets.js';
import { DLNADiscovery, browseAll, discoverReceiverAVTransport } from '@o-control/upnp';
import { normalizeMusicCatalog } from './music-catalog.js';
import { ArtworkCache } from './artwork-cache.js';

const config = loadConfig();

const app = Fastify({
  bodyLimit: 8 * 1024 * 1024,
  logger: {
    level: config.LOG_LEVEL,
  },
});

const musicArtworkCache = new ArtworkCache();
const pendingArtwork = new Map<string, Promise<{ buffer: Buffer; contentType: string } | null>>();
const missingArtwork = new Map<string, number>();
const artworkUriIndex = new Map<string, string>();
const MISSING_ARTWORK_TTL_MS = 10 * 60 * 1000;
const MAX_ARTWORK_URI_ENTRIES = 2_000;

function rememberArtworkUris(serverId: string, items: Array<{ id: string; albumArtURI?: string }>): void {
  for (const item of items) {
    if (!item.albumArtURI) continue;
    const key = `${serverId}\0${item.id}`;
    artworkUriIndex.delete(key);
    artworkUriIndex.set(key, item.albumArtURI);
  }
  while (artworkUriIndex.size > MAX_ARTWORK_URI_ENTRIES) {
    const oldest = artworkUriIndex.keys().next().value as string | undefined;
    if (!oldest) break;
    artworkUriIndex.delete(oldest);
  }
}

// ── State & Receiver ─────────────────────────────────────────
const store = new StateStore();
const receiver = new ReceiverClient({
  host: config.ONKYO_HOST,
  port: config.ONKYO_PORT,
  logger: app.log as any,
  mockMode: config.MOCK_MODE,
});

// 1x1 red pixel JPEG base64
export const MOCK_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

export let cachedCoverArt: Buffer | null = null;

export function setCachedCoverArt(buf: Buffer | null): void {
  cachedCoverArt = buf;
}

const CORE_QUERIES = [
  COMMANDS.POWER_QUERY,
  COMMANDS.VOLUME_QUERY,
  COMMANDS.MUTE_QUERY,
  COMMANDS.INPUT_QUERY,
  COMMANDS.PLAYBACK_STATUS_QUERY,
];

const METADATA_QUERIES = [
  COMMANDS.TITLE_QUERY,
  COMMANDS.ARTIST_QUERY,
  COMMANDS.ALBUM_QUERY,
  COMMANDS.TIME_QUERY,
  COMMANDS.TRACK_QUERY,
  COMMANDS.FORMAT_QUERY,
];

let metadataRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let timeQueryTimer: ReturnType<typeof setInterval> | undefined;
let lastPlayback = store.getState().playback;
let lastInput = store.getState().input;
let hasQueriedCore = false;
let hasScheduledInitialMetadataRefresh = false;

interface PlayQueueItem {
  resourceUrl: string;
  title?: string;
  artist?: string;
  album?: string;
  mimeType?: string;
  albumArtURI?: string;
  size?: number;
}

let playQueue: PlayQueueItem[] = [];
let playQueueIndex = -1;
let isDlnaMode = false;
let userStopped = false;
let mockEndTimer: ReturnType<typeof setTimeout> | undefined;
let receiverReadyAt = 0;
const RECEIVER_BOOT_GRACE_MS = 3500;

// Wire receiver events to state store
receiver.on('packet', (packet: ParsedPacket) => {
  const known = store.reduce(packet);
  if (!known) {
    app.log.info({ cmd: packet.command, payload: packet.rawPayload }, 'Unknown eISCP event');
  }
});

receiver.on('connected', () => {
  store.setConnected(true);
  if (!hasQueriedCore) {
    hasQueriedCore = true;
    void queryInitialState();
  }
  if (!hasScheduledInitialMetadataRefresh) {
    hasScheduledInitialMetadataRefresh = true;
    scheduleMetadataRefresh(1200);
  }
});

receiver.on('disconnected', () => {
  store.setConnected(false);
  clearMetadataTimers();
});

async function sendQueries(commands: readonly string[], context: string): Promise<void> {
  for (const cmd of commands) {
    try {
      await receiver.send(cmd);
    } catch (err) {
      app.log.error({ err, cmd, context }, 'Failed to query receiver');
    }
  }
}

function markReceiverPowerOn(): void {
  receiverReadyAt = Math.max(receiverReadyAt, Date.now() + RECEIVER_BOOT_GRACE_MS);
}

async function queryInitialState(): Promise<void> {
  await sendQueries(CORE_QUERIES, 'initial-state');
}

async function queryMetadata(): Promise<void> {
  await sendQueries(METADATA_QUERIES, 'metadata-refresh');
}

function scheduleMetadataRefresh(delayMs = 800): void {
  if (metadataRefreshTimer) {
    clearTimeout(metadataRefreshTimer);
  }
  metadataRefreshTimer = setTimeout(() => {
    metadataRefreshTimer = undefined;
    void queryMetadata();
  }, delayMs);
}

function clearMetadataTimers(): void {
  if (metadataRefreshTimer) {
    clearTimeout(metadataRefreshTimer);
    metadataRefreshTimer = undefined;
  }
  if (timeQueryTimer) {
    clearInterval(timeQueryTimer);
    timeQueryTimer = undefined;
  }
}

let lastTitle = store.getState().nowPlaying.title;
let currentFetchController: AbortController | null = null;
let fetchTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function hasUsableCoverArt(buffer: Buffer): boolean {
  return buffer.length > 0;
}

/**
 * Background worker to fetch the album art CGI with retry mechanism.
 */
async function resolveMusicServerCoverArt(targetTitle: string, retryCount = 0): Promise<void> {
  // Guard against race conditions: check if track title changed
  const state = store.getState();
  if (state.nowPlaying.title !== targetTitle || !(state.input === 'net' || state.input === 'usb')) {
    return;
  }

  // Cancel any existing fetch
  if (currentFetchController) {
    currentFetchController.abort();
    currentFetchController = null;
  }

  currentFetchController = new AbortController();
  const signal = currentFetchController.signal;

  try {
    const res = await fetch(`http://${config.ONKYO_HOST}/album_art.cgi`, { signal });
    if (res.ok) {
      const rawBuffer = Buffer.from(await res.arrayBuffer());
      const cleaned = stripOnkyoHeaders(rawBuffer);
      if (hasUsableCoverArt(cleaned)) {
        cachedCoverArt = cleaned;
        store.setCoverArt('/cover-art?t=' + Date.now());
        return;
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return;
  }

  // Retry logic (up to 2 retries, total 3 attempts)
  if (retryCount < 2) {
    const delay = retryCount === 0 ? 2000 : 4000;
    fetchTimeoutId = setTimeout(() => {
      void resolveMusicServerCoverArt(targetTitle, retryCount + 1);
    }, delay);
  } else {
    // Final failure
    store.setCoverArt(undefined);
  }
}

function triggerCoverArtResolution(title: string): void {
  // Clear any pending scheduled fetch
  if (fetchTimeoutId) {
    clearTimeout(fetchTimeoutId);
    fetchTimeoutId = null;
  }
  if (currentFetchController) {
    currentFetchController.abort();
    currentFetchController = null;
  }
  cachedCoverArt = null;

  if (title) {
    const activeTrack = isDlnaMode ? playQueue[playQueueIndex] : undefined;
    if (activeTrack?.albumArtURI && (!activeTrack.title || activeTrack.title === title)) {
      store.setCoverArt(activeTrack.albumArtURI);
      return;
    }
    if (config.MOCK_MODE) {
      // Mock mode sets cover art immediately
      store.setCoverArt('/cover-art?t=' + Date.now());
    } else {
      // Real receiver starts background resolution after 1000ms delay
      fetchTimeoutId = setTimeout(() => {
        void resolveMusicServerCoverArt(title, 0);
      }, 1000);
    }
  } else {
    store.setCoverArt(undefined);
  }
}

store.subscribe((state) => {
  if (!state.connected) {
    clearMetadataTimers();
    lastPlayback = state.playback;
    lastInput = state.input;
    lastTitle = state.nowPlaying.title;
    return;
  }

  if (state.input !== lastInput) {
    lastInput = state.input;
    lastPlayback = state.playback;
    lastTitle = '';
    store.resetNowPlaying();
    triggerCoverArtResolution('');
    scheduleMetadataRefresh(1000);

    // Reset DLNA queue state
    isDlnaMode = false;
    playQueue = [];
    playQueueIndex = -1;
    if (mockEndTimer) {
      clearTimeout(mockEndTimer);
      mockEndTimer = undefined;
    }
  } else if (state.playback !== lastPlayback && state.playback === 'playing') {
    scheduleMetadataRefresh(1000);
  }

  // Auto-advance to next track on natural transition to stopped
  if (isDlnaMode && state.playback === 'stopped' && lastPlayback === 'playing') {
    if (!userStopped) {
      app.log.info('DLNA track ended naturally, auto-playing next track');
      void playNextDlnaTrack();
    }
  }

  if (state.nowPlaying.title !== lastTitle) {
    lastTitle = state.nowPlaying.title;
    if (state.input === 'net' || state.input === 'usb') {
      triggerCoverArtResolution(state.nowPlaying.title);
    } else {
      triggerCoverArtResolution('');
    }
  }

  if (state.playback === 'playing' && !timeQueryTimer) {
    timeQueryTimer = setInterval(() => {
      void sendQueries([COMMANDS.TIME_QUERY], 'time-refresh');
    }, 5000);
  } else if (state.playback !== 'playing' && timeQueryTimer) {
    clearInterval(timeQueryTimer);
    timeQueryTimer = undefined;
  }

  lastPlayback = state.playback;
  lastInput = state.input;
});

// ── WebSocket plugin ─────────────────────────────────────────
app.register(cors, {
  origin: true,
});
app.register(websocket);

// ── Routes ───────────────────────────────────────────────────

// Health check
app.get('/health', async () => {
  const state = store.getState();
  return {
    status: 'ok',
    connected: state.connected,
    mockMode: config.MOCK_MODE,
    receiverHost: config.ONKYO_HOST,
    receiverPort: config.ONKYO_PORT,
    uptime: process.uptime(),
  };
});

// Full state
app.get('/state', async () => {
  return {
    ...store.getState(),
    queue: {
      currentIndex: playQueueIndex,
      items: playQueue.map(({ resourceUrl, title, artist, album, albumArtURI, size }) => ({
        resourceUrl, title, artist, album, albumArtURI, size,
      })),
    },
  };
});

app.post('/dlna/queue/clear', async () => {
  const current = playQueue[playQueueIndex];
  playQueue = current ? [current] : [];
  playQueueIndex = current ? 0 : -1;
  return { success: true };
});

// Presets list
app.get('/presets', async () => {
  return loadPresets();
});

app.get('/cover-art', async (request, reply) => {
  const state = store.getState();

  // 0. If in Mock Mode, return mock cover art if a song is playing
  if (config.MOCK_MODE) {
    if (state.nowPlaying.title) {
      reply.type('image/jpeg').send(MOCK_JPEG);
      return;
    }
  }

  // 1. If we have a base64 data URI in the state store, parse and return it
  if (state.nowPlaying.coverArtUrl?.startsWith('data:')) {
    const match = state.nowPlaying.coverArtUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const contentType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      reply.type(contentType).send(buffer);
      return;
    }
  }

  // 2. Proxy remote artwork through the local service. The desktop WebView CSP
  // intentionally does not allow arbitrary LAN image origins.
  if (state.nowPlaying.coverArtUrl?.startsWith('http') && !state.nowPlaying.coverArtUrl.includes('album_art.cgi')) {
    try {
      const artworkUrl = new URL(state.nowPlaying.coverArtUrl);
      if (artworkUrl.protocol === 'http:' || artworkUrl.protocol === 'https:') {
        const response = await fetch(artworkUrl, { signal: AbortSignal.timeout(5000) });
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        if (response.ok && contentType.toLowerCase().startsWith('image/')) {
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length > 0 && buffer.length <= 5 * 1024 * 1024) {
            reply.header('Cache-Control', 'private, max-age=21600');
            reply.type(contentType).send(buffer);
            return;
          }
        }
      }
    } catch {
      // Fall through to receiver artwork and the final 404.
    }
  }

  // 3. Return cached cover art if available
  if (cachedCoverArt && hasUsableCoverArt(cachedCoverArt)) {
    reply.type('image/jpeg').send(cachedCoverArt);
    return;
  }

  // 4. CR-N775 exposes the current cover at this endpoint when Music Server is active.
  if (state.connected && config.ONKYO_HOST) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(`http://${config.ONKYO_HOST}/album_art.cgi`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const rawBuffer = Buffer.from(await res.arrayBuffer());
        const cleaned = stripOnkyoHeaders(rawBuffer);
        if (hasUsableCoverArt(cleaned)) {
          cachedCoverArt = cleaned;
          reply.type('image/jpeg').send(cleaned);
          return;
        }
      }
    } catch (e) {
      // Fetch failed or timed out, fall through
    }
  }

  reply.code(404).send({
    success: false,
    message: 'Cover art unavailable',
  });
});

// ── Command Endpoints ────────────────────────────────────────

// Power
const powerSchema = z.object({
  action: z.enum(['on', 'off', 'toggle']).default('toggle'),
});

app.post('/commands/power', async (request, reply) => {
  const body = powerSchema.parse(request.body ?? {});
  let cmd: string;

  if (body.action === 'toggle') {
    const state = store.getState();
    cmd = state.power === 'on' ? COMMANDS.POWER_OFF : COMMANDS.POWER_ON;
  } else {
    cmd = body.action === 'on' ? COMMANDS.POWER_ON : COMMANDS.POWER_OFF;
  }

  await receiver.send(cmd);
  if (cmd === COMMANDS.POWER_ON) markReceiverPowerOn();
  return { success: true, command: cmd };
});

// Volume
const volumeSchema = z.object({
  value: z.union([
    z.enum(['up', 'down']),
    z.number().int().min(0).max(100),
  ]),
});

app.post('/commands/volume', async (request, reply) => {
  const body = volumeSchema.parse(request.body);
  let cmd: string;

  if (body.value === 'up') {
    cmd = COMMANDS.VOLUME_UP;
  } else if (body.value === 'down') {
    cmd = COMMANDS.VOLUME_DOWN;
  } else {
    cmd = buildVolumeCommand(body.value);
  }

  await receiver.send(cmd);
  return { success: true, command: cmd };
});

// Mute
const muteSchema = z.object({
  action: z.enum(['on', 'off', 'toggle']).default('toggle'),
});

app.post('/commands/mute', async (request, reply) => {
  const body = muteSchema.parse(request.body ?? {});
  let cmd: string;

  if (body.action === 'toggle') {
    const state = store.getState();
    cmd = state.muted ? COMMANDS.MUTE_OFF : COMMANDS.MUTE_ON;
  } else {
    cmd = body.action === 'on' ? COMMANDS.MUTE_ON : COMMANDS.MUTE_OFF;
  }

  await receiver.send(cmd);
  return { success: true, command: cmd };
});

// Input
const inputSchema = z.object({
  input: z.enum(['cd', 'net', 'usb', 'bluetooth', 'line', 'tuner'] as const),
});

app.post('/commands/input', async (request, reply) => {
  const body = inputSchema.parse(request.body);
  const hexCode = INPUT_CODES[body.input as InputId];
  const cmd = buildInputCommand(hexCode);

  await receiver.send(cmd);
  return { success: true, command: cmd };
});

// Playback
const playbackSchema = z.object({
  action: z.enum(['play', 'pause', 'stop', 'next', 'previous'] as const),
});

async function playNextDlnaTrack() {
  if (playQueueIndex + 1 < playQueue.length) {
    playQueueIndex++;
    const track = playQueue[playQueueIndex];
    app.log.info({ title: track.title, index: playQueueIndex }, 'Playing next DLNA track');
    await playDlnaTrackInternal(track, app.log);
  } else {
    app.log.info('End of playlist, stopping DLNA autoplay');
    isDlnaMode = false;
    if (!config.MOCK_MODE) {
      await receiver.send(COMMANDS.NET_STOP);
    } else {
      store.reduce({ command: 'NST', rawPayload: 'S--' });
    }
  }
}

async function playPrevDlnaTrack() {
  if (playQueueIndex - 1 >= 0) {
    playQueueIndex--;
    const track = playQueue[playQueueIndex];
    app.log.info({ title: track.title, index: playQueueIndex }, 'Playing previous DLNA track');
    await playDlnaTrackInternal(track, app.log);
  }
}

app.post('/commands/playback', async (request, reply) => {
  const body = playbackSchema.parse(request.body);

  if (body.action === 'stop') {
    userStopped = true;
    if (mockEndTimer) {
      clearTimeout(mockEndTimer);
      mockEndTimer = undefined;
    }
  } else if (body.action === 'pause') {
    if (mockEndTimer) {
      clearTimeout(mockEndTimer);
      mockEndTimer = undefined;
    }
  }

  if (isDlnaMode && playQueue.length > 0) {
    if (body.action === 'next') {
      await playNextDlnaTrack();
      return { success: true, command: 'DLNA_NEXT' };
    } else if (body.action === 'previous') {
      await playPrevDlnaTrack();
      return { success: true, command: 'DLNA_PREV' };
    }
  }

  const cmdMap: Record<PlaybackCommand, string> = {
    play: COMMANDS.NET_PLAY,
    pause: COMMANDS.NET_PAUSE,
    stop: COMMANDS.NET_STOP,
    next: COMMANDS.NET_NEXT,
    previous: COMMANDS.NET_PREV,
  };

  const cmd = cmdMap[body.action];
  await receiver.send(cmd);

  if (body.action === 'next' || body.action === 'previous' || body.action === 'play') {
    scheduleMetadataRefresh(1200);
  }

  return { success: true, command: cmd };
});

// Run Preset
app.post<{ Params: { id: string } }>('/presets/:id/run', async (request, reply) => {
  const preset = findPreset(request.params.id);
  if (!preset) {
    reply.code(404);
    return { success: false, message: `Preset "${request.params.id}" not found` };
  }

  app.log.info({ presetId: preset.id, steps: preset.steps.length }, 'Running preset');

  for (const step of preset.steps) {
    await receiver.send(step.command);
    if (step.command === COMMANDS.POWER_ON) markReceiverPowerOn();
    if (step.delayMs) {
      await new Promise((r) => setTimeout(r, step.delayMs));
    }
  }

  return { success: true, presetId: preset.id, message: `Ran preset "${preset.name}"` };
});

// Network List Navigation
const listActionSchema = z.object({
  action: z.enum(['up', 'down', 'enter', 'back', 'select'] as const),
  index: z.number().int().min(0).optional(),
});

const listQuerySchema = z.object({
  type: z.enum(['title', 'items', 'both'] as const).default('both'),
});

app.post('/commands/list/action', async (request, reply) => {

  const body = listActionSchema.parse(request.body);
  let cmd: string;

  switch (body.action) {
    case 'up':
      cmd = 'OSDUP';
      break;
    case 'down':
      cmd = 'OSDDOWN';
      break;
    case 'enter':
      cmd = 'OSDENTER';
      break;
    case 'back':
      cmd = 'OSDRETURN';
      break;
    case 'select': {
      const selectIndex = body.index !== undefined ? body.index + 1 : 1;
      const indexStr = String(selectIndex).padStart(5, '0');
      cmd = `NLSI${indexStr}`;
      await receiver.send(cmd);
      // Wait 50ms before sending enter/play command to ensure receiver registers selection
      await new Promise((resolve) => setTimeout(resolve, 50));
      cmd = 'OSDENTER';
      break;
    }
  }

  await receiver.send(cmd);
  return { success: true, command: cmd };
});

app.post('/commands/list/query', async (request, reply) => {
  const body = listQuerySchema.parse(request.body ?? {});
  const state = store.getState();

  if (state.input !== 'net' && state.input !== 'usb') {
    reply.code(400);
    return { success: false, message: 'Network list browsing only supported on Net or USB inputs' };
  }

  const queries: string[] = [];
  if (body.type === 'title' || body.type === 'both') {
    queries.push('NLTQSTN');
  }
  if (body.type === 'items' || body.type === 'both') {
    queries.push('NLSQSTN');
  }

  for (const q of queries) {
    await receiver.send(q);
  }

  return { success: true, queries };
});

// ── WebSocket Events ─────────────────────────────────────────
app.register(async (fastify) => {
  fastify.get('/events', { websocket: true }, (socket, request) => {
    fastify.log.info('WebSocket client connected');

    // Send current state immediately
    const event: OControlEvent = {
      type: 'state.changed',
      state: store.getState(),
    };
    socket.send(JSON.stringify(event));

    // Subscribe to state changes
    const unsubscribe = store.subscribe((state) => {
      const event: OControlEvent = {
        type: 'state.changed',
        state,
      };
      try {
        socket.send(JSON.stringify(event));
      } catch {
        // Client disconnected
      }
    });

    socket.on('close', () => {
      fastify.log.info('WebSocket client disconnected');
      unsubscribe();
    });
  });
});

// ── Error handler ────────────────────────────────────────────
app.setErrorHandler((error: FastifyError, request, reply) => {
  if (error.validation) {
    reply.status(400).send({
      success: false,
      message: 'Validation error',
      errors: error.validation,
    });
    return;
  }

  app.log.error(error);
  reply.status(500).send({
    success: false,
    message: error.message,
  });
});

/**
 * Safely strips the 3-line proprietary header from the Onkyo CGI response.
 * Scans for common image magic bytes first (JPEG, PNG, BMP) as a primary check.
 * Falls back to finding the 3rd newline character (0x0A) within the first 500 bytes.
 */
export function stripOnkyoHeaders(buffer: Buffer): Buffer {
  // 1. Scan for JPEG signature (FF D8)
  const jpegIdx = buffer.indexOf(Buffer.from([0xff, 0xd8]));
  if (jpegIdx !== -1 && jpegIdx < 500) {
    return buffer.subarray(jpegIdx);
  }

  // 2. Scan for PNG signature (89 50 4E 47)
  const pngIdx = buffer.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (pngIdx !== -1 && pngIdx < 500) {
    return buffer.subarray(pngIdx);
  }

  // 3. Scan for BMP signature (42 4D)
  const bmpIdx = buffer.indexOf(Buffer.from([0x42, 0x4d]));
  if (bmpIdx !== -1 && bmpIdx < 500) {
    return buffer.subarray(bmpIdx);
  }

  // 4. Fallback to scanning for the 3rd newline
  let newlineCount = 0;
  let idx = 0;
  while (newlineCount < 3 && idx < buffer.length && idx < 500) {
    if (buffer[idx] === 0x0a) {
      newlineCount++;
    }
    idx++;
  }

  if (newlineCount === 3) {
    return buffer.subarray(idx);
  }

  return buffer;
}

// ── DLNA Discovery & Browse ───────────────────────────────────
const dlnaDiscovery = new DLNADiscovery({ scanInterval: 30_000 });

dlnaDiscovery.on('serverFound', (server) => {
  app.log.info({ name: server.friendlyName, host: server.host }, 'DLNA server discovered');
});

// ── Receiver AVTransport Discovery ────────────────────────────
let cachedAVTransportUrl: string | null = null;
let receiverDiscoveryController: AbortController | null = null;

async function getReceiverAVTransportUrl(): Promise<string | null> {
  if (cachedAVTransportUrl) return cachedAVTransportUrl;
  receiverDiscoveryController ??= new AbortController();
  const url = await discoverReceiverAVTransport(
    config.ONKYO_HOST,
    receiverDiscoveryController.signal,
  );
  if (url) {
    cachedAVTransportUrl = url;
    app.log.info({ url }, 'Discovered receiver AVTransport control URL');
  }
  return url;
}

function cleanupRuntime(): void {
  clearMetadataTimers();
  receiverReadyAt = 0;

  if (fetchTimeoutId) {
    clearTimeout(fetchTimeoutId);
    fetchTimeoutId = null;
  }
  currentFetchController?.abort();
  currentFetchController = null;

  if (mockEndTimer) {
    clearTimeout(mockEndTimer);
    mockEndTimer = undefined;
  }

  receiverDiscoveryController?.abort();
  receiverDiscoveryController = null;
  dlnaDiscovery.stop();
  receiver.destroy();
}

async function closeRuntime(): Promise<void> {
  if (app.server.listening) {
    try {
      await app.close();
    } finally {
      cleanupRuntime();
    }
    return;
  }
  cleanupRuntime();
}

app.addHook('onClose', async () => {
  cleanupRuntime();
});

let startPromise: Promise<void> | null = null;
let stopRequested = false;

export async function stop(): Promise<void> {
  stopRequested = true;
  if (startPromise) {
    await startPromise.catch(() => {});
  }
  await closeRuntime();
}

async function startRuntime(): Promise<void> {
  await app.listen({ port: config.O_CONTROL_PORT, host: config.O_CONTROL_HOST });

  try {
    if (stopRequested) {
      await closeRuntime();
      return;
    }

    receiver.connect();

    if (!config.MOCK_MODE) {
      dlnaDiscovery.start();
      void getReceiverAVTransportUrl();
    }

    app.log.info(`O-Control service listening on ${config.O_CONTROL_HOST}:${config.O_CONTROL_PORT}`);
  } catch (err) {
    try {
      await closeRuntime();
    } catch (closeErr) {
      app.log.error(closeErr, 'Failed to close service after startup failure');
    }
    throw err;
  }
}

export function start(): Promise<void> {
  startPromise ??= startRuntime();
  return startPromise;
}

app.get('/dlna/servers', async (_request, reply) => {
  const servers = dlnaDiscovery.getServers().map(s => ({
    id: s.id,
    friendlyName: s.friendlyName,
    host: s.host,
  }));
  return { servers };
});

app.post('/dlna/scan', async (_request, reply) => {
  dlnaDiscovery.scan();
  return { success: true, message: 'SSDP scan triggered' };
});

const dlnaBrowseSchema = z.object({
  serverId: z.string(),
  objectId: z.string().default('0'),
});

app.post('/dlna/browse', async (request, reply) => {
  const body = dlnaBrowseSchema.parse(request.body);
  const server = dlnaDiscovery.getServer(body.serverId);

  if (!server) {
    reply.code(404);
    return { success: false, error: 'Server not found. Try /dlna/scan first.' };
  }

  try {
    const result = await browseAll(server.contentDirectoryUrl, body.objectId);
    rememberArtworkUris(body.serverId, result.items);
    return {
      title: body.objectId === '0' ? server.friendlyName : undefined,
      items: result.items,
      totalMatches: result.totalMatches,
    };
  } catch (err) {
    app.log.error(err, 'DLNA browse failed');
    reply.code(502);
    return { success: false, error: 'Failed to browse DLNA server' };
  }
});

const musicCatalogQuerySchema = z.object({
  serverId: z.string(),
  objectId: z.string().default('0'),
});

/** Return normalized album/artist views for one lazily browsed MusicServer container. */
app.get('/music/catalog', async (request, reply) => {
  const query = musicCatalogQuerySchema.parse(request.query);
  const server = dlnaDiscovery.getServer(query.serverId);
  if (!server) {
    reply.code(404);
    return { success: false, error: 'Server not found. Try /dlna/scan first.' };
  }

  try {
    const result = await browseAll(server.contentDirectoryUrl, query.objectId);
    rememberArtworkUris(query.serverId, result.items);
    return {
      server: { id: server.id, friendlyName: server.friendlyName },
      objectId: query.objectId,
      ...normalizeMusicCatalog(result.items),
    };
  } catch (err) {
    app.log.error(err, 'Music catalog browse failed');
    reply.code(502);
    return { success: false, error: 'Failed to load MusicServer catalog' };
  }
});

const dlnaArtworkQuerySchema = z.object({ serverId: z.string(), objectId: z.string() });

async function resolveDlnaArtwork(serverId: string, objectId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const key = `${serverId}\0${objectId}`;
  const cached = musicArtworkCache.get(key);
  if (cached) return cached;
  const missingUntil = missingArtwork.get(key);
  if (missingUntil && missingUntil > Date.now()) return null;
  if (missingUntil) missingArtwork.delete(key);
  const existing = pendingArtwork.get(key);
  if (existing) return existing;

  const request = (async () => {
    const server = dlnaDiscovery.getServer(serverId);
    if (!server) return null;
    let artUri = artworkUriIndex.get(key);
    if (artUri) {
      artworkUriIndex.delete(key);
      artworkUriIndex.set(key, artUri);
    } else {
      const result = await browseAll(server.contentDirectoryUrl, objectId);
      artUri = result.items.find((item) => item.albumArtURI)?.albumArtURI;
    }
    if (!artUri) {
      missingArtwork.set(key, Date.now() + MISSING_ARTWORK_TTL_MS);
      return null;
    }
    const artworkUrl = new URL(artUri, server.contentDirectoryUrl);
    if (artworkUrl.protocol !== 'http:' && artworkUrl.protocol !== 'https:') {
      missingArtwork.set(key, Date.now() + MISSING_ARTWORK_TTL_MS);
      return null;
    }
    const response = await fetch(artworkUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      missingArtwork.set(key, Date.now() + MISSING_ARTWORK_TTL_MS);
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024 || !contentType.startsWith('image/')) {
      missingArtwork.set(key, Date.now() + MISSING_ARTWORK_TTL_MS);
      return null;
    }
    const value = { buffer, contentType };
    musicArtworkCache.set(key, value);
    missingArtwork.delete(key);
    return value;
  })().finally(() => pendingArtwork.delete(key));
  pendingArtwork.set(key, request);
  return request;
}

app.get('/dlna/artwork', async (request, reply) => {
  const query = dlnaArtworkQuerySchema.parse(request.query);
  if (!dlnaDiscovery.getServer(query.serverId)) {
    reply.code(404);
    return { success: false, error: 'Server not found' };
  }
  try {
    const artwork = await resolveDlnaArtwork(query.serverId, query.objectId);
    if (!artwork) {
      reply.code(404);
      return { success: false, error: 'Artwork not found' };
    }
    reply.header('Content-Type', artwork.contentType);
    reply.header('Cache-Control', 'private, max-age=21600');
    return reply.send(artwork.buffer);
  } catch (err) {
    app.log.warn({ err, objectId: query.objectId }, 'Failed to resolve DLNA artwork');
    reply.code(502);
    return { success: false, error: 'Artwork fetch failed' };
  }
});

app.get('/dlna/artwork-cache/stats', async () => ({
  ...musicArtworkCache.stats(),
  uriEntries: artworkUriIndex.size,
  pending: pendingArtwork.size,
  negativeEntries: [...missingArtwork.values()].filter((expiresAt) => expiresAt > Date.now()).length,
}));

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const dlnaPlaySchema = z.object({
  resourceUrl: z.string().url(),
  title: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  mimeType: z.string().optional(),
  albumArtURI: z.string().url().optional(),
  size: z.number().int().nonnegative().optional(),
  playlist: z.array(z.object({
    resourceUrl: z.string().url(),
    title: z.string().optional(),
    artist: z.string().optional(),
    album: z.string().optional(),
    mimeType: z.string().optional(),
    albumArtURI: z.string().url().optional(),
    size: z.number().int().nonnegative().optional(),
  })).optional(),
});

export function isTransitionNotAvailableFault(body: string): boolean {
  return /<errorCode>\s*701\s*<\/errorCode>/i.test(body)
    || /Transition not available/i.test(body);
}

/**
 * A receiver can briefly reject AVTransport requests while it is booting or
 * switching to Network input. These failures are safe to retry for a short
 * bounded window; malformed media URLs and other 4xx responses are not.
 */
export function isRetryableAVTransportFailure(status: number, body: string): boolean {
  return status >= 500
    || isTransitionNotAvailableFault(body)
    || /no current (transport|media)|not ready|temporarily unavailable/i.test(body);
}

const AVTRANSPORT_RETRY_DELAYS_MS = [750, 1500, 3000] as const;

function applyQueuedTrackState(track: PlayQueueItem): void {
  if (track.title) store.reduce({ command: 'NTI', rawPayload: track.title });
  if (track.artist) store.reduce({ command: 'NAT', rawPayload: track.artist });
  if (track.album) store.reduce({ command: 'NAL', rawPayload: track.album });
  store.reduce({ command: 'NST', rawPayload: 'P--' });
  if (track.albumArtURI) store.setCoverArt(track.albumArtURI);
  store.setFileSize(track.size);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playDlnaTrackInternal(track: PlayQueueItem, log: typeof app.log): Promise<{ success: boolean; avTransportUrl?: string; error?: string; detail?: string }> {
  if (config.MOCK_MODE) {
    log.info({ url: track.resourceUrl }, 'Mock DLNA playback started');
    store.reduce({ command: 'NTI', rawPayload: track.title || 'Mock Title' });
    store.reduce({ command: 'NAT', rawPayload: track.artist || 'Mock Artist' });
    if (track.album) store.reduce({ command: 'NAL', rawPayload: track.album });
    store.reduce({ command: 'NST', rawPayload: 'P--' }); // playing status
    if (track.albumArtURI) store.setCoverArt(track.albumArtURI);
    store.setFileSize(track.size);
    return { success: true };
  }

  const bootDelay = receiverReadyAt - Date.now();
  if (bootDelay > 0) {
    log.info({ delayMs: bootDelay }, 'Waiting for receiver network input after power on');
    await delay(bootDelay);
  }

  const currentInput = store.getState().input;
  if (currentInput !== 'net' && currentInput !== 'usb') {
    const netHex = INPUT_CODES['net'];
    const netCmd = buildInputCommand(netHex);
    log.info({ netCmd, currentInput }, 'Switching receiver input to NET for DLNA playback');
    await receiver.send(netCmd);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  const titleXml = track.title ? `<dc:title>${escapeXml(track.title)}</dc:title>` : '';
  const artistXml = track.artist ? `<upnp:artist>${escapeXml(track.artist)}</upnp:artist>` : '';
  const albumXml = track.album ? `<upnp:album>${escapeXml(track.album)}</upnp:album>` : '';
  const mimeType = track.mimeType ?? 'audio/mpeg';
  const escapedUrl = escapeXml(track.resourceUrl);
  const escapedMime = escapeXml(mimeType);

  const didl = `<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"><item id="1" parentID="0" restricted="1">${titleXml}${artistXml}${albumXml}<upnp:class>object.item.audioItem.musicTrack</upnp:class><res protocolInfo="http-get:*:${escapedMime}:*">${escapedUrl}</res></item></DIDL-Lite>`;
  const escapedDidl = escapeXml(didl);

  const setURIBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <CurrentURI>${escapedUrl}</CurrentURI>
      <CurrentURIMetaData>${escapedDidl}</CurrentURIMetaData>
    </u:SetAVTransportURI>
  </s:Body>
</s:Envelope>`;

  const playBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <Speed>1</Speed>
    </u:Play>
  </s:Body>
  </s:Envelope>`;

  let lastError: { error: string; detail: string } | null = null;
  for (let attempt = 0; attempt <= AVTRANSPORT_RETRY_DELAYS_MS.length; attempt++) {
    const avTransportUrl = await getReceiverAVTransportUrl();
    if (!avTransportUrl) {
      lastError = {
        error: 'Failed to discover receiver AVTransport service',
        detail: `No UPnP device description found on ${config.ONKYO_HOST}. Is the receiver powered on?`,
      };
    } else {
      try {
        log.info({ avTransportUrl, attempt: attempt + 1 }, 'Sending SetAVTransportURI');
        const setRes = await fetch(avTransportUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"',
          },
          body: setURIBody,
          signal: AbortSignal.timeout(5000),
        });

        if (!setRes.ok) {
          const text = await setRes.text().catch(() => '');
          lastError = {
            error: 'SetAVTransportURI failed',
            detail: `Status ${setRes.status}: ${text.substring(0, 200)}`,
          };
          if (!isRetryableAVTransportFailure(setRes.status, text)) {
            log.error({ status: setRes.status, body: text.substring(0, 200) }, 'SetAVTransportURI failed');
            return { success: false, ...lastError };
          }
        } else {
          log.info({ avTransportUrl, attempt: attempt + 1 }, 'Sending Play');
          const playRes = await fetch(avTransportUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/xml; charset="utf-8"',
              'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#Play"',
            },
            body: playBody,
            signal: AbortSignal.timeout(5000),
          });

          if (!playRes.ok) {
            const text = await playRes.text().catch(() => '');
            if (isTransitionNotAvailableFault(text)) {
              log.info({ status: playRes.status, avTransportUrl }, 'Receiver accepted the new URI while Play transition was still in progress');
              applyQueuedTrackState(track);
              return { success: true, avTransportUrl };
            }
            lastError = {
              error: 'Play command failed',
              detail: `Status ${playRes.status}: ${text.substring(0, 200)}`,
            };
            if (!isRetryableAVTransportFailure(playRes.status, text)) {
              log.error({ status: playRes.status, body: text.substring(0, 200) }, 'Play failed');
              return { success: false, ...lastError };
            }
          } else {
            log.info({ url: track.resourceUrl, avTransport: avTransportUrl }, 'DLNA playback started');
            applyQueuedTrackState(track);
            return { success: true, avTransportUrl };
          }
        }
      } catch (err) {
        cachedAVTransportUrl = null;
        const msg = err instanceof Error ? err.message : String(err);
        lastError = { error: 'AVTransport request failed', detail: msg };
        log.warn({ err: msg, avTransportUrl, attempt: attempt + 1 }, 'AVTransport request failed; retrying if receiver is still starting');
      }
    }

    if (attempt < AVTRANSPORT_RETRY_DELAYS_MS.length) {
      cachedAVTransportUrl = null;
      await delay(AVTRANSPORT_RETRY_DELAYS_MS[attempt]);
    }
  }

  log.error(lastError, 'AVTransport playback failed after retries');
  return { success: false, ...lastError! };
}

app.post('/dlna/play', async (request, reply) => {
  const body = dlnaPlaySchema.parse(request.body);

  if (mockEndTimer) {
    clearTimeout(mockEndTimer);
    mockEndTimer = undefined;
  }

  isDlnaMode = true;
  userStopped = false;

  if (body.playlist && body.playlist.length > 0) {
    playQueue = body.playlist;
    playQueueIndex = playQueue.findIndex(track => track.resourceUrl === body.resourceUrl);
  } else {
    playQueue = [{ resourceUrl: body.resourceUrl, title: body.title, artist: body.artist, album: body.album, mimeType: body.mimeType, albumArtURI: body.albumArtURI, size: body.size }];
    playQueueIndex = 0;
  }

  const currentTrack = playQueue[playQueueIndex] || {
    resourceUrl: body.resourceUrl,
    title: body.title,
    artist: body.artist,
    album: body.album,
    mimeType: body.mimeType,
    albumArtURI: body.albumArtURI,
    size: body.size,
  };

  const res = await playDlnaTrackInternal(currentTrack, app.log);

  if (!res.success) {
    reply.code(502);
    return { success: false, error: res.error, detail: res.detail };
  }

  return { success: true, avTransportUrl: res.avTransportUrl };
});

// Export for testing
export { app, store, receiver, dlnaDiscovery };
