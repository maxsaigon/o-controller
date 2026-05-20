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

const config = loadConfig();

const app = Fastify({
  logger: {
    level: config.LOG_LEVEL,
  },
});

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
      cachedCoverArt = cleaned;
      store.setCoverArt('/cover-art?t=' + Date.now());
      return;
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
  } else if (state.playback !== lastPlayback && state.playback === 'playing') {
    scheduleMetadataRefresh(1000);
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
  return store.getState();
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

  // 2. If the receiver provided a URL, use that URL directly.
  if (state.nowPlaying.coverArtUrl?.startsWith('http') && !state.nowPlaying.coverArtUrl.includes('album_art.cgi')) {
    reply.redirect(state.nowPlaying.coverArtUrl);
    return;
  }

  // 3. Return cached cover art if available
  if (cachedCoverArt) {
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
        cachedCoverArt = cleaned;
        reply.type('image/jpeg').send(cleaned);
        return;
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

app.post('/commands/playback', async (request, reply) => {
  const body = playbackSchema.parse(request.body);

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
      cmd = 'NLAUP';
      break;
    case 'down':
      cmd = 'NLADN';
      break;
    case 'enter':
      cmd = 'NLAENT';
      break;
    case 'back':
      // Send standard list return first
      await receiver.send('NLARET');
      // Also send general remote control Return key to ensure compatibility on all models (like CR-N775)
      cmd = 'IEC17';
      break;
    case 'select': {
      const selectIndex = body.index !== undefined ? body.index + 1 : 1;
      const indexStr = String(selectIndex).padStart(5, '0');
      cmd = `NLSI${indexStr}`;
      await receiver.send(cmd);
      // Wait 50ms before sending enter/play command to ensure receiver registers selection
      await new Promise((resolve) => setTimeout(resolve, 50));
      cmd = 'NLAENT';
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

// ── Start ────────────────────────────────────────────────────
export async function start(): Promise<void> {
  try {
    await app.listen({ port: config.O_CONTROL_PORT, host: '0.0.0.0' });
    receiver.connect();
    app.log.info(`O-Control service listening on port ${config.O_CONTROL_PORT}`);
  } catch (err) {
    app.log.fatal(err);
    process.exit(1);
  }
}

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

// Export for testing
export { app, store, receiver };
