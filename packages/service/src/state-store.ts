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
}
