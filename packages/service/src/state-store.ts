import type {
  OControlState,
  NowPlayingMeta,
  InputId,
  PlaybackStatus,
} from '@o-control/shared';
import {
  DEFAULT_STATE,
  DEFAULT_NOW_PLAYING,
  INPUT_CODE_TO_ID,
  DEFAULT_NET_LIST,
} from '@o-control/shared';
import { hexToVolume } from '@o-control/eiscp';
import type { ParsedPacket } from '@o-control/eiscp';

export type StateListener = (state: OControlState) => void;

/**
 * In-memory state store with reducer pattern.
 * Accepts raw eISCP parsed packets and produces normalized state.
 */
export class StateStore {
  private state: OControlState;
  private listeners: Set<StateListener> = new Set();

  // Buffers for NJA (Album Art) packets
  private jacketArtBuffer: string = '';
  private jacketArtType: string = '';

  constructor(initial?: Partial<OControlState>) {
    this.state = {
      ...DEFAULT_STATE,
      nowPlaying: { ...DEFAULT_NOW_PLAYING },
      ...initial,
    };
  }

  /** Get a snapshot of current state */
  getState(): OControlState {
    return { ...this.state, nowPlaying: { ...this.state.nowPlaying } };
  }

  /** Subscribe to state changes */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Notify all listeners */
  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  /** Set connection status */
  setConnected(connected: boolean): void {
    if (this.state.connected !== connected) {
      this.state.connected = connected;
      if (!connected) {
        // Reset state on disconnect
        this.state.power = 'unknown';
      }
      this.notify();
    }
  }

  /**
   * Reduce a parsed eISCP packet into state updates.
   * Returns false only when the command group is unknown.
   */
  reduce(packet: ParsedPacket): boolean {
    const { command, rawPayload } = packet;
    let known = true;
    let changed = false;

    switch (command) {
      // ── Power ──
      case 'PWR': {
        const power = rawPayload === '01' ? 'on' : 'off';
        if (this.state.power !== power) {
          this.state.power = power;
          changed = true;
        }
        break;
      }

      // ── Volume ──
      case 'MVL': {
        if (rawPayload === 'UP' || rawPayload === 'DOWN') break;
        const volume = hexToVolume(rawPayload);
        if (this.state.volume !== volume) {
          this.state.volume = volume;
          changed = true;
        }
        break;
      }

      // ── Mute ──
      case 'AMT': {
        const muted = rawPayload === '01';
        if (this.state.muted !== muted) {
          this.state.muted = muted;
          changed = true;
        }
        break;
      }

      // ── Input Selector ──
      case 'SLI': {
        const inputId = INPUT_CODE_TO_ID[rawPayload] ?? 'unknown';
        if (this.state.input !== inputId) {
          this.state.input = inputId;
          changed = true;
        }
        break;
      }

      // ── Now Playing: Title ──
      case 'NTI': {
        if (this.state.nowPlaying.title !== rawPayload) {
          this.state.nowPlaying.title = rawPayload;
          changed = true;
        }
        break;
      }

      // ── Now Playing: Artist ──
      case 'NAT': {
        if (this.state.nowPlaying.artist !== rawPayload) {
          this.state.nowPlaying.artist = rawPayload;
          changed = true;
        }
        break;
      }

      // ── Now Playing: Album ──
      case 'NAL': {
        if (this.state.nowPlaying.album !== rawPayload) {
          this.state.nowPlaying.album = rawPayload;
          changed = true;
        }
        break;
      }

      // ── Playback Status ──
      case 'NST': {
        const statusChar = rawPayload[0];
        let playback: PlaybackStatus;
        switch (statusChar) {
          case 'P': playback = 'playing'; break;
          case 'S': playback = 'stopped'; break;
          case 'p':
          case 'x': playback = 'paused'; break;
          case 'F': playback = 'ff'; break;
          case 'R': playback = 'rew'; break;
          default: playback = 'unknown';
        }
        if (this.state.playback !== playback) {
          this.state.playback = playback;
          changed = true;
        }
        break;
      }

      // ── Time ──
      case 'NTM': {
        // Format: "mm:ss/mm:ss" or "hh:mm:ss/hh:mm:ss"
        const parts = rawPayload.split('/');
        const currentTime = parts[0] ?? '';
        const totalTime = parts[1] ?? '';
        if (
          this.state.nowPlaying.currentTime !== currentTime ||
          this.state.nowPlaying.totalTime !== totalTime
        ) {
          this.state.nowPlaying.currentTime = currentTime;
          this.state.nowPlaying.totalTime = totalTime;
          changed = true;
        }
        break;
      }

      // ── Track Number ──
      case 'NTR': {
        // Format: "cccc/tttt" (current/total)
        const trackNumber = rawPayload;
        if (this.state.nowPlaying.trackNumber !== trackNumber) {
          this.state.nowPlaying.trackNumber = trackNumber;
          changed = true;
        }
        break;
      }

      // ── File Info ──
      case 'NFI': {
        // CR-N775 returns values like: "FLAC/96kHz/24bit"
        const [format = '', sampleRate = '', bitDepth = ''] = rawPayload
          .split('/')
          .map((part) => part.trim());

        if (
          this.state.nowPlaying.format !== format ||
          this.state.nowPlaying.sampleRate !== sampleRate ||
          this.state.nowPlaying.bitDepth !== bitDepth
        ) {
          this.state.nowPlaying.format = format || undefined;
          this.state.nowPlaying.sampleRate = sampleRate || undefined;
          this.state.nowPlaying.bitDepth = bitDepth || undefined;
          changed = true;
        }
        break;
      }

      // ── Jacket Art (Cover Photo) ──
      case 'NJA': {
        // Format: tpxxxxxx...
        // t: 0=BMP, 1=JPEG, 2=URL, n=No image
        // p: 0=Start, 1=Next, 2=End, -=Not used
        const type = rawPayload[0];
        const flag = rawPayload[1];
        const data = rawPayload.slice(2);

        if (type === 'n') {
           if (this.state.nowPlaying.coverArtUrl) {
             this.state.nowPlaying.coverArtUrl = undefined;
             changed = true;
           }
           this.jacketArtBuffer = '';
           break;
        }

        if (type === '2') {
           // URL
           let url = data;
           if (!url.startsWith('http')) {
               try {
                  url = Buffer.from(data, 'hex').toString('utf8');
               } catch (e) {}
           }
           if (this.state.nowPlaying.coverArtUrl !== url) {
             this.state.nowPlaying.coverArtUrl = url;
             changed = true;
           }
           this.jacketArtBuffer = '';
           break;
        }

        // Binary Image Data (0=BMP, 1=JPEG)
        if (flag === '0') {
           this.jacketArtBuffer = data;
           this.jacketArtType = type;
        } else if (flag === '1') {
           this.jacketArtBuffer += data;
        } else if (flag === '2') {
           this.jacketArtBuffer += data;
           try {
             const mime = this.jacketArtType === '0' ? 'image/bmp' : 'image/jpeg';
             const base64 = Buffer.from(this.jacketArtBuffer, 'hex').toString('base64');
             const dataUrl = `data:${mime};base64,${base64}`;
             if (this.state.nowPlaying.coverArtUrl !== dataUrl) {
               this.state.nowPlaying.coverArtUrl = dataUrl;
               changed = true;
             }
           } catch (err) {
             // Failed to decode hex
           }
           this.jacketArtBuffer = '';
        }
        break;
      }

      // ── Net List Title ──
      case 'NLT': {
        let titleText = rawPayload;
        // Strip 22-character header prefix: xxuycccciiiillrraabbss if present
        if (rawPayload.length >= 22 && /^[0-9A-Fa-f]{2}[0-9A-Za-z]{2}[0-9A-Fa-f]{18}/.test(rawPayload)) {
          titleText = rawPayload.slice(22);
        }
        if (this.state.netList.title !== titleText) {
          this.state.netList.title = titleText;
          this.state.netList.items = []; // Clear items on folder change
          this.state.netList.cursor = -1;
          changed = true;
        }
        break;
      }

      // ── Net List Select/Info ──
      case 'NLS': {
        const type = rawPayload[0];
        if (type === 'U' || type === 'A') {
          // Format: U<index><separator><name>
          // E.g., "U0/Tag View" -> type='U', index='0', separator='/', name='Tag View'
          // E.g., "U10-Song Name" -> type='U', index='10', separator='-', name='Song Name'
          const match = rawPayload.match(/^([UA])(\d+)([\/\-])(.*)$/);
          if (match) {
            const lineNum = parseInt(match[2], 10);
            const separator = match[3];
            const name = match[4];
            let itemType: 'folder' | 'file' | 'unknown' = 'unknown';
            if (separator === '/') {
              itemType = 'folder';
            } else if (separator === '-') {
              itemType = 'file';
            }

            const existingItems = [...this.state.netList.items];
            const itemIdx = existingItems.findIndex(item => item.index === lineNum);
            const newItem = { index: lineNum, name, type: itemType };

            if (itemIdx >= 0) {
              existingItems[itemIdx] = newItem;
            } else {
              existingItems.push(newItem);
              existingItems.sort((a, b) => a.index - b.index);
            }

            this.state.netList.items = existingItems;
            changed = true;
          }
        } else if (type === 'C') {
          const match = rawPayload.match(/^C(\d+)/);
          if (match) {
            const cursor = parseInt(match[1], 10);
            if (this.state.netList.cursor !== cursor) {
              this.state.netList.cursor = cursor;
              changed = true;
            }
          }
        }
        break;
      }

      default:
        known = false;
    }

    if (changed) {
      this.notify();
    }
    return known;
  }

  /** Reset now-playing metadata (e.g. on input change) */
  resetNowPlaying(): void {
    this.state.nowPlaying = { ...DEFAULT_NOW_PLAYING };
    this.notify();
  }

  /** Reset network list state */
  resetNetList(): void {
    this.state.netList = { ...DEFAULT_NET_LIST };
    this.notify();
  }

  /** Set cover art explicitly (e.g. from album_art.cgi fallback) */
  setCoverArt(url: string | undefined): void {
    if (this.state.nowPlaying.coverArtUrl !== url) {
      this.state.nowPlaying.coverArtUrl = url;
      this.notify();
    }
  }
}
