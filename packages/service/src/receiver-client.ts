import net from 'node:net';
import { EventEmitter } from 'node:events';
import { buildPacket, parsePackets, COMMANDS } from '@o-control/eiscp';
import type { ParsedPacket } from '@o-control/eiscp';
import type { Logger } from 'pino';

export interface ReceiverClientOptions {
  host: string;
  port: number;
  logger: Logger;
  /** Minimum ms between outgoing commands (default 50) */
  commandInterval?: number;
  /** Enable mock mode (no real TCP connection) */
  mockMode?: boolean;
}

interface QueuedCommand {
  command: string;
  resolve: () => void;
  reject: (err: Error) => void;
}

/**
 * TCP client wrapper for Onkyo/Integra receivers.
 * Handles connection, reconnection, packet framing, and command queue.
 *
 * Events:
 *  - 'packet': (packet: ParsedPacket) — received a parsed packet
 *  - 'connected': () — connected to receiver
 *  - 'disconnected': () — lost connection
 */
export class ReceiverClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private queue: QueuedCommand[] = [];
  private sending = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;
  private readonly host: string;
  private readonly port: number;
  private readonly logger: Logger;
  private readonly commandInterval: number;
  private readonly mockMode: boolean;

  constructor(options: ReceiverClientOptions) {
    super();
    this.host = options.host;
    this.port = options.port;
    this.logger = options.logger;
    this.commandInterval = options.commandInterval ?? 50;
    this.mockMode = options.mockMode ?? false;
  }

  /** Connect to the receiver (or start mock mode) */
  connect(): void {
    if (this.mockMode) {
      this.logger.info('Running in mock mode — no real receiver connection');
      this.emit('connected');
      return;
    }

    this.logger.info({ host: this.host, port: this.port }, 'Connecting to receiver');
    this.socket = new net.Socket();

    this.socket.on('connect', () => {
      this.reconnectAttempt = 0;
      this.logger.info('Connected to receiver');
      this.emit('connected');
    });

    this.socket.on('data', (data: Buffer) => {
      this.handleData(data);
    });

    this.socket.on('close', () => {
      this.logger.warn('Receiver connection closed');
      this.emit('disconnected');
      this.scheduleReconnect();
    });

    this.socket.on('error', (err: Error) => {
      this.logger.error({ err: err.message }, 'Receiver connection error');
    });

    this.socket.connect(this.port, this.host);
  }

  /** Send a raw ISCP command to the receiver */
  send(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.mockMode) {
        this.logger.debug({ command }, 'Mock send');
        // Simulate mock response for queries
        this.simulateMockResponse(command);
        resolve();
        return;
      }

      this.queue.push({ command, resolve, reject });
      this.processQueue();
    });
  }

  /** Disconnect and clean up */
  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  // ── Private ────────────────────────────────────────────────

  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
    const { packets, remaining } = parsePackets(this.buffer);
    this.buffer = remaining;

    for (const packet of packets) {
      this.logger.debug({ cmd: packet.command, payload: packet.rawPayload }, 'Received packet');
      this.emit('packet', packet);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.sending || this.queue.length === 0) return;
    this.sending = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      if (!this.socket || this.socket.destroyed) {
        item.reject(new Error('Not connected to receiver'));
        continue;
      }

      try {
        const packet = buildPacket(item.command);
        this.socket.write(packet);
        this.logger.debug({ command: item.command }, 'Sent command');
        item.resolve();
      } catch (err) {
        item.reject(err instanceof Error ? err : new Error(String(err)));
      }

      // Enforce minimum interval between commands
      if (this.queue.length > 0) {
        await this.delay(this.commandInterval);
      }
    }

    this.sending = false;
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const backoff = Math.min(30_000, 1000 * Math.pow(2, this.reconnectAttempt));
    this.reconnectAttempt++;

    this.logger.info({ backoffMs: backoff, attempt: this.reconnectAttempt }, 'Scheduling reconnect');

    this.reconnectTimer = setTimeout(() => {
      this.socket?.destroy();
      this.socket = null;
      this.buffer = Buffer.alloc(0);
      this.connect();
    }, backoff);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * In mock mode, simulate receiver responses for common queries.
   */
  private simulateMockResponse(command: string): void {
    const responses: Record<string, ParsedPacket> = {
      [COMMANDS.POWER_QUERY]: { command: 'PWR', rawPayload: '01' },
      [COMMANDS.POWER_ON]: { command: 'PWR', rawPayload: '01' },
      [COMMANDS.POWER_OFF]: { command: 'PWR', rawPayload: '00' },
      [COMMANDS.VOLUME_QUERY]: { command: 'MVL', rawPayload: '1A' },
      [COMMANDS.VOLUME_UP]: { command: 'MVL', rawPayload: '1B' },
      [COMMANDS.VOLUME_DOWN]: { command: 'MVL', rawPayload: '19' },
      [COMMANDS.MUTE_QUERY]: { command: 'AMT', rawPayload: '00' },
      [COMMANDS.MUTE_ON]: { command: 'AMT', rawPayload: '01' },
      [COMMANDS.MUTE_OFF]: { command: 'AMT', rawPayload: '00' },
      [COMMANDS.INPUT_QUERY]: { command: 'SLI', rawPayload: '2B' },
      [COMMANDS.TITLE_QUERY]: { command: 'NTI', rawPayload: 'Mock Song' },
      [COMMANDS.ARTIST_QUERY]: { command: 'NAT', rawPayload: 'Mock Artist' },
      [COMMANDS.ALBUM_QUERY]: { command: 'NAL', rawPayload: 'Mock Album' },
      [COMMANDS.PLAYBACK_STATUS_QUERY]: { command: 'NST', rawPayload: 'P--' },
    };

    // Handle volume set commands (MVLxx)
    if (command.startsWith('MVL') && command.length === 5 && command !== COMMANDS.VOLUME_QUERY) {
      const payload = command.substring(3);
      if (/^[0-9A-Fa-f]{2}$/.test(payload)) {
        setTimeout(() => this.emit('packet', { command: 'MVL', rawPayload: payload.toUpperCase() }), 10);
        return;
      }
    }

    // Handle input set commands (SLIxx)
    if (command.startsWith('SLI') && command.length === 5 && command !== COMMANDS.INPUT_QUERY) {
      const payload = command.substring(3);
      setTimeout(() => this.emit('packet', { command: 'SLI', rawPayload: payload.toUpperCase() }), 10);
      return;
    }

    const response = responses[command];
    if (response) {
      setTimeout(() => this.emit('packet', response), 10);
    }
  }
}
