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
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
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

// Wire receiver events to state store
receiver.on('packet', (packet: ParsedPacket) => {
  const known = store.reduce(packet);
  if (!known) {
    app.log.info({ cmd: packet.command, payload: packet.rawPayload }, 'Unknown eISCP event');
  }
});

receiver.on('connected', () => {
  store.setConnected(true);
  // Query initial state
  void queryInitialState();
});

receiver.on('disconnected', () => {
  store.setConnected(false);
});

async function queryInitialState(): Promise<void> {
  const queries = [
    COMMANDS.POWER_QUERY,
    COMMANDS.VOLUME_QUERY,
    COMMANDS.MUTE_QUERY,
    COMMANDS.INPUT_QUERY,
    COMMANDS.PLAYBACK_STATUS_QUERY,
    COMMANDS.TITLE_QUERY,
    COMMANDS.ARTIST_QUERY,
    COMMANDS.ALBUM_QUERY,
  ];
  for (const cmd of queries) {
    try {
      await receiver.send(cmd);
    } catch (err) {
      app.log.error({ err, cmd }, 'Failed to query initial state');
    }
  }
}

// ── WebSocket plugin ─────────────────────────────────────────
await app.register(cors, {
  origin: true,
});
await app.register(websocket);

// ── Routes ───────────────────────────────────────────────────

// Health check
app.get('/health', async () => {
  const state = store.getState();
  return {
    status: 'ok',
    connected: state.connected,
    mockMode: config.MOCK_MODE,
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

// ── WebSocket Events ─────────────────────────────────────────
app.get('/events', { websocket: true }, (socket, request) => {
  app.log.info('WebSocket client connected');

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
    app.log.info('WebSocket client disconnected');
    unsubscribe();
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

// Export for testing
export { app, store, receiver };
