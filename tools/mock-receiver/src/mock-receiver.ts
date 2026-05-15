import net from 'node:net';
import { buildPacket, parsePackets } from '@o-control/eiscp';
import type { ParsedPacket } from '@o-control/eiscp';

/**
 * Mock Onkyo receiver for testing.
 * Listens on a TCP port and responds to eISCP commands like a CR-N775.
 */

interface MockReceiverState {
  power: boolean;
  volume: number;    // 0–100
  muted: boolean;
  input: string;     // hex code
  playback: string;  // P=playing, S=stopped, x=paused
  title: string;
  artist: string;
  album: string;
}

export interface MockReceiverOptions {
  port?: number;
  host?: string;
  /** Whether to send periodic status events */
  simulateEvents?: boolean;
  /** Interval in ms for simulated events (default 5000) */
  eventInterval?: number;
}

export class MockReceiver {
  private server: net.Server;
  private clients: Set<net.Socket> = new Set();
  private state: MockReceiverState;
  private eventTimer: ReturnType<typeof setInterval> | null = null;
  private readonly options: Required<MockReceiverOptions>;

  constructor(options: MockReceiverOptions = {}) {
    this.options = {
      port: options.port ?? 60128,
      host: options.host ?? '0.0.0.0',
      simulateEvents: options.simulateEvents ?? false,
      eventInterval: options.eventInterval ?? 5000,
    };

    this.state = {
      power: true,
      volume: 26,
      muted: false,
      input: '2B',  // NET
      playback: 'P',
      title: 'Blue Train',
      artist: 'John Coltrane',
      album: 'Blue Train',
    };

    this.server = net.createServer((socket) => this.handleConnection(socket));
  }

  /** Start listening */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.options.port, this.options.host, () => {
        console.log(`[MockReceiver] Listening on ${this.options.host}:${this.options.port}`);
        resolve();
      });

      if (this.options.simulateEvents) {
        this.startEventSimulation();
      }
    });
  }

  /** Stop the server and disconnect all clients */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.eventTimer) {
        clearInterval(this.eventTimer);
      }
      for (const client of this.clients) {
        client.destroy();
      }
      this.clients.clear();
      this.server.close(() => {
        console.log('[MockReceiver] Stopped');
        resolve();
      });
    });
  }

  /** Get the actual port the server is listening on */
  getPort(): number {
    const addr = this.server.address();
    if (addr && typeof addr === 'object') {
      return addr.port;
    }
    return this.options.port;
  }

  /** Simulate a disconnect/reconnect scenario */
  async simulateDisconnect(durationMs: number = 2000): Promise<void> {
    console.log('[MockReceiver] Simulating disconnect...');
    for (const client of this.clients) {
      client.destroy();
    }
    this.clients.clear();
    // Server stays up but connections are killed
    await new Promise((r) => setTimeout(r, durationMs));
    console.log('[MockReceiver] Clients can reconnect now');
  }

  // ── Private ────────────────────────────────────────────────

  private handleConnection(socket: net.Socket): void {
    console.log(`[MockReceiver] Client connected from ${socket.remoteAddress}`);
    this.clients.add(socket);

    let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);

    socket.on('data', (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);
      const { packets, remaining } = parsePackets(buffer);
      buffer = remaining;

      for (const packet of packets) {
        this.handlePacket(socket, packet);
      }
    });

    socket.on('close', () => {
      console.log('[MockReceiver] Client disconnected');
      this.clients.delete(socket);
    });

    socket.on('error', (err) => {
      console.log(`[MockReceiver] Client error: ${err.message}`);
      this.clients.delete(socket);
    });
  }

  private handlePacket(socket: net.Socket, packet: ParsedPacket): void {
    const { command, rawPayload } = packet;
    console.log(`[MockReceiver] Received: ${command}${rawPayload}`);

    switch (command) {
      // ── Power ──
      case 'PWR': {
        if (rawPayload === 'QSTN') {
          this.respond(socket, 'PWR', this.state.power ? '01' : '00');
        } else if (rawPayload === '01') {
          this.state.power = true;
          this.respond(socket, 'PWR', '01');
        } else if (rawPayload === '00') {
          this.state.power = false;
          this.respond(socket, 'PWR', '00');
        }
        break;
      }

      // ── Volume ──
      case 'MVL': {
        if (rawPayload === 'QSTN') {
          this.respond(socket, 'MVL', this.volumeHex());
        } else if (rawPayload === 'UP') {
          this.state.volume = Math.min(100, this.state.volume + 1);
          this.respond(socket, 'MVL', this.volumeHex());
        } else if (rawPayload === 'DOWN') {
          this.state.volume = Math.max(0, this.state.volume - 1);
          this.respond(socket, 'MVL', this.volumeHex());
        } else {
          // Set volume to hex value
          const vol = parseInt(rawPayload, 16);
          if (!isNaN(vol)) {
            this.state.volume = Math.max(0, Math.min(100, vol));
            this.respond(socket, 'MVL', this.volumeHex());
          }
        }
        break;
      }

      // ── Mute ──
      case 'AMT': {
        if (rawPayload === 'QSTN') {
          this.respond(socket, 'AMT', this.state.muted ? '01' : '00');
        } else if (rawPayload === '01') {
          this.state.muted = true;
          this.respond(socket, 'AMT', '01');
        } else if (rawPayload === '00') {
          this.state.muted = false;
          this.respond(socket, 'AMT', '00');
        }
        break;
      }

      // ── Input ──
      case 'SLI': {
        if (rawPayload === 'QSTN') {
          this.respond(socket, 'SLI', this.state.input);
        } else {
          this.state.input = rawPayload;
          this.respond(socket, 'SLI', this.state.input);
        }
        break;
      }

      // ── Net Transport ──
      case 'NTC': {
        if (rawPayload === 'PLAY') {
          this.state.playback = 'P';
          this.respond(socket, 'NST', `${this.state.playback}--`);
        } else if (rawPayload === 'PAUSE') {
          this.state.playback = 'x';
          this.respond(socket, 'NST', `${this.state.playback}--`);
        } else if (rawPayload === 'STOP') {
          this.state.playback = 'S';
          this.respond(socket, 'NST', `${this.state.playback}--`);
        } else if (rawPayload === 'TRUP' || rawPayload === 'TRDN') {
          // Simulate track change
          this.respond(socket, 'NST', `${this.state.playback}--`);
          this.respond(socket, 'NTI', 'Next Track');
        }
        break;
      }

      // ── Metadata queries ──
      case 'NTI': {
        if (rawPayload === 'QSTN') {
          this.respond(socket, 'NTI', this.state.title);
        }
        break;
      }
      case 'NAT': {
        if (rawPayload === 'QSTN') {
          this.respond(socket, 'NAT', this.state.artist);
        }
        break;
      }
      case 'NAL': {
        if (rawPayload === 'QSTN') {
          this.respond(socket, 'NAL', this.state.album);
        }
        break;
      }
      case 'NST': {
        if (rawPayload === 'QSTN') {
          this.respond(socket, 'NST', `${this.state.playback}--`);
        }
        break;
      }
      case 'NTM': {
        if (rawPayload === 'QSTN') {
          this.respond(socket, 'NTM', '01:23/04:56');
        }
        break;
      }
      case 'NTR': {
        if (rawPayload === 'QSTN') {
          this.respond(socket, 'NTR', '0003/0012');
        }
        break;
      }

      default:
        console.log(`[MockReceiver] Unknown command: ${command}${rawPayload}`);
    }
  }

  private respond(socket: net.Socket, command: string, payload: string): void {
    if (socket.destroyed) return;
    const packet = buildPacket(`${command}${payload}`);
    socket.write(packet);
    console.log(`[MockReceiver] Responded: ${command}${payload}`);
  }

  private volumeHex(): string {
    return this.state.volume.toString(16).toUpperCase().padStart(2, '0');
  }

  private broadcastToAll(command: string, payload: string): void {
    for (const client of this.clients) {
      this.respond(client, command, payload);
    }
  }

  private startEventSimulation(): void {
    this.eventTimer = setInterval(() => {
      // Simulate volume knob turning
      if (Math.random() > 0.5) {
        const delta = Math.random() > 0.5 ? 1 : -1;
        this.state.volume = Math.max(0, Math.min(100, this.state.volume + delta));
        this.broadcastToAll('MVL', this.volumeHex());
      }
    }, this.options.eventInterval);
  }
}
