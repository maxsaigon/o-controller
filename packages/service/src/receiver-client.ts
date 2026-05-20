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
interface MockFolder {
  title: string;
  items: { name: string; type: 'folder' | 'file' }[];
}

const MOCK_FOLDERS: Record<string, MockFolder> = {
  'root': {
    title: 'Music Server',
    items: [
      { name: 'My Favorite', type: 'folder' },
      { name: 'TuneIn Radio', type: 'folder' },
      { name: 'Music Server (NAS)', type: 'folder' },
      { name: 'USB Storage', type: 'folder' },
    ],
  },
  'Music Server (NAS)': {
    title: 'Music Server (NAS)',
    items: [
      { name: 'Artists', type: 'folder' },
      { name: 'Albums', type: 'folder' },
      { name: 'Folders', type: 'folder' },
    ],
  },
  'Folders': {
    title: 'Folders',
    items: [
      { name: 'Pop Music', type: 'folder' },
      { name: 'Rock Classics', type: 'folder' },
      { name: 'Jazz & Blues', type: 'folder' },
    ],
  },
  'Pop Music': {
    title: 'Pop Music',
    items: [
      { name: 'Khúc Giao Mùa.flac', type: 'file' },
      { name: 'Chờ Đông.flac', type: 'file' },
      { name: 'Tình Đơn Phương.mp3', type: 'file' },
    ],
  },
  'Rock Classics': {
    title: 'Rock Classics',
    items: [
      { name: 'Bohemian Rhapsody.flac', type: 'file' },
      { name: 'Hotel California.mp3', type: 'file' },
      { name: 'Stairway to Heaven.wav', type: 'file' },
    ],
  },
  'Jazz & Blues': {
    title: 'Jazz & Blues',
    items: [
      { name: 'Take Five.mp3', type: 'file' },
      { name: 'Blue in Green.flac', type: 'file' },
    ],
  },
};

export class ReceiverClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private queue: QueuedCommand[] = [];
  private sending = false;
  private connecting: Promise<void> | null = null;
  private destroyed = false;
  private readonly host: string;
  private readonly port: number;
  private readonly logger: Logger;
  private readonly commandInterval: number;
  private readonly mockMode: boolean;
  private lastCommandAt = 0;
  private mockPath: string[] = ['root'];
  private mockCursor = 0;

  constructor(options: ReceiverClientOptions) {
    super();
    this.host = options.host;
    this.port = options.port;
    this.logger = options.logger;
    this.commandInterval = options.commandInterval ?? 150;
    this.mockMode = options.mockMode ?? false;
  }

  /** Connect to the receiver (or start mock mode) */
  connect(): void {
    if (this.mockMode) {
      this.logger.info('Running in mock mode — no real receiver connection');
      this.emit('connected');
      return;
    }

    void this.ensureConnected().catch((err) => {
      this.logger.error({ err: err.message }, 'Receiver connection failed');
      this.emit('disconnected');
    });
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
        try {
          await this.ensureConnected();
        } catch (err) {
          this.emit('disconnected');
          item.reject(err instanceof Error ? err : new Error(String(err)));
          continue;
        }
      }

      try {
        const elapsed = Date.now() - this.lastCommandAt;
        if (elapsed < this.commandInterval) {
          await this.delay(this.commandInterval - elapsed);
        }

        const packet = buildPacket(item.command);
        const socket = this.socket;
        if (!socket || socket.destroyed) {
          throw new Error('Not connected to receiver');
        }
        socket.write(packet);
        this.lastCommandAt = Date.now();
        this.logger.debug({ command: item.command }, 'Sent command');
        item.resolve();
      } catch (err) {
        item.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }

    this.sending = false;
  }

  private ensureConnected(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return Promise.resolve();
    }
    if (this.connecting) {
      return this.connecting;
    }
    if (this.destroyed) {
      return Promise.reject(new Error('Receiver client is destroyed'));
    }

    this.logger.info({ host: this.host, port: this.port }, 'Connecting to receiver');
    this.socket = new net.Socket();
    this.buffer = Buffer.alloc(0);

    this.connecting = new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.connecting = null;
          this.socket?.destroy();
          reject(new Error('Receiver connection timed out'));
        }
      }, 4000);

      this.socket?.once('connect', () => {
        settled = true;
        clearTimeout(timeout);
        this.connecting = null;
        this.logger.info('Connected to receiver');
        this.emit('connected');
        resolve();
      });

      this.socket?.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      this.socket?.once('close', () => {
        this.logger.debug('Receiver TCP session closed');
        this.socket = null;
        this.buffer = Buffer.alloc(0);
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          this.connecting = null;
          reject(new Error('Receiver connection closed before connect'));
        }
      });

      this.socket?.once('error', (err: Error) => {
        this.logger.error({ err: err.message }, 'Receiver connection error');
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          this.connecting = null;
          reject(err);
        }
      });

      this.socket?.connect(this.port, this.host);
    });

    return this.connecting;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * In mock mode, simulate receiver responses for common queries.
   */
  private simulateMockResponse(command: string): void {
    const currentFolderKey = this.mockPath[this.mockPath.length - 1] || 'root';
    const folder = MOCK_FOLDERS[currentFolderKey] || MOCK_FOLDERS['root'];

    if (command === 'NLTQSTN') {
      setTimeout(() => {
        this.emit('packet', { command: 'NLT', rawPayload: folder.title });
      }, 5);
      return;
    }

    if (command === 'NLSQSTN') {
      setTimeout(() => {
        folder.items.forEach((item, idx) => {
          const sep = item.type === 'folder' ? '/' : '-';
          this.emit('packet', { command: 'NLS', rawPayload: `U${idx}${sep}${item.name}` });
        });
        this.emit('packet', { command: 'NLS', rawPayload: `C${this.mockCursor}` });
      }, 10);
      return;
    }

    if (command === 'NLAUP' || command === 'OSDUP') {
      if (this.mockCursor > 0) {
        this.mockCursor--;
        setTimeout(() => {
          this.emit('packet', { command: 'NLS', rawPayload: `C${this.mockCursor}` });
        }, 5);
      }
      return;
    }

    if (command === 'NLADN' || command === 'OSDDOWN') {
      if (this.mockCursor < folder.items.length - 1) {
        this.mockCursor++;
        setTimeout(() => {
          this.emit('packet', { command: 'NLS', rawPayload: `C${this.mockCursor}` });
        }, 5);
      }
      return;
    }

    if (command === 'NLARET' || command === 'IEC17' || command === 'OSDRETURN') {
      if (this.mockPath.length > 1) {
        this.mockPath.pop();
        this.mockCursor = 0;
        const parentKey = this.mockPath[this.mockPath.length - 1] || 'root';
        const parentFolder = MOCK_FOLDERS[parentKey] || MOCK_FOLDERS['root'];
        setTimeout(() => {
          this.emit('packet', { command: 'NLT', rawPayload: parentFolder.title });
          parentFolder.items.forEach((item, idx) => {
            const sep = item.type === 'folder' ? '/' : '-';
            this.emit('packet', { command: 'NLS', rawPayload: `U${idx}${sep}${item.name}` });
          });
          this.emit('packet', { command: 'NLS', rawPayload: `C${this.mockCursor}` });
        }, 10);
      }
      return;
    }

    if (command === 'NLAENT' || command === 'OSDENTER') {
      const item = folder.items[this.mockCursor];
      if (item) {
        if (item.type === 'folder') {
          this.mockPath.push(item.name);
          this.mockCursor = 0;
          const nextFolder = MOCK_FOLDERS[item.name] || { title: item.name, items: [] };
          setTimeout(() => {
            this.emit('packet', { command: 'NLT', rawPayload: nextFolder.title });
            nextFolder.items.forEach((subItem, idx) => {
              const sep = subItem.type === 'folder' ? '/' : '-';
              this.emit('packet', { command: 'NLS', rawPayload: `U${idx}${sep}${subItem.name}` });
            });
            this.emit('packet', { command: 'NLS', rawPayload: `C${this.mockCursor}` });
          }, 10);
        } else {
          // Play file
          setTimeout(() => {
            this.emit('packet', { command: 'NTI', rawPayload: item.name.replace(/\.[^/.]+$/, "") });
            this.emit('packet', { command: 'NAT', rawPayload: 'Mock Artist' });
            this.emit('packet', { command: 'NAL', rawPayload: folder.title });
            this.emit('packet', { command: 'NST', rawPayload: 'P--' });
          }, 10);
        }
      }
      return;
    }

    if (command.startsWith('NLSI')) {
      const idx = parseInt(command.substring(4), 10) - 1;
      const item = folder.items[idx];
      if (item) {
        this.mockCursor = idx;
        setTimeout(() => {
          this.emit('packet', { command: 'NLS', rawPayload: `C${this.mockCursor}` });
        }, 10);
      }
      return;
    }

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
      [COMMANDS.TITLE_QUERY]: { command: 'NTI', rawPayload: 'Khúc Giao Mùa (Chờ Đông) - A Very Long Title That Should Wrap Properly' },
      [COMMANDS.ARTIST_QUERY]: { command: 'NAT', rawPayload: 'Various Artists featuring Some Exceptionally Long Names' },
      [COMMANDS.ALBUM_QUERY]: { command: 'NAL', rawPayload: 'The Greatest Hits Album Featuring Remastered Tracks (Deluxe Edition)' },
      [COMMANDS.PLAYBACK_STATUS_QUERY]: { command: 'NST', rawPayload: 'P--' },
      [COMMANDS.TIME_QUERY]: { command: 'NTM', rawPayload: '01:23/04:56' },
      [COMMANDS.TRACK_QUERY]: { command: 'NTR', rawPayload: '0002/0015' },
      [COMMANDS.FORMAT_QUERY]: { command: 'NFI', rawPayload: 'FLAC/96kHz/24bit' },
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
