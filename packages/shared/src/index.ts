// ─── Input IDs ───────────────────────────────────────────────
// Common Onkyo input selector hex codes for CR-N775
export type InputId =
  | 'cd'       // 0x23
  | 'net'      // 0x2B
  | 'usb'      // 0x29
  | 'bluetooth' // 0x2E
  | 'line'     // 0x02
  | 'tuner';   // 0x26

/** Hex codes sent via SLI command for each input */
export const INPUT_CODES: Record<InputId, string> = {
  cd: '23',
  net: '2B',
  usb: '29',
  bluetooth: '2E',
  line: '02',
  tuner: '26',
} as const;

/** Reverse lookup: hex code → InputId */
export const INPUT_CODE_TO_ID: Record<string, InputId> = Object.fromEntries(
  Object.entries(INPUT_CODES).map(([k, v]) => [v, k as InputId]),
) as Record<string, InputId>;

// ─── Playback ────────────────────────────────────────────────
export type PlaybackStatus = 'stopped' | 'playing' | 'paused' | 'ff' | 'rew' | 'unknown';

export type PlaybackCommand =
  | 'play'
  | 'pause'
  | 'stop'
  | 'next'
  | 'previous';

export const PLAYBACK_CODES: Record<PlaybackCommand, string> = {
  play: 'PLAY',
  pause: 'PAUSE',
  stop: 'STOP',
  next: 'TRUP',
  previous: 'TRDN',
} as const;

// ─── State ───────────────────────────────────────────────────
export interface NowPlayingMeta {
  title: string;
  artist: string;
  album: string;
  currentTime: string;   // e.g. "01:23"
  totalTime: string;     // e.g. "04:56"
  trackNumber: string;
}

export interface OControlState {
  connected: boolean;
  power: 'on' | 'off' | 'unknown';
  input: InputId | 'unknown';
  volume: number;           // 0–100 (hex 0x00–0x64)
  muted: boolean;
  playback: PlaybackStatus;
  nowPlaying: NowPlayingMeta;
}

export const DEFAULT_NOW_PLAYING: NowPlayingMeta = {
  title: '',
  artist: '',
  album: '',
  currentTime: '',
  totalTime: '',
  trackNumber: '',
};

export const DEFAULT_STATE: OControlState = {
  connected: false,
  power: 'unknown',
  input: 'unknown',
  volume: 0,
  muted: false,
  playback: 'unknown',
  nowPlaying: { ...DEFAULT_NOW_PLAYING },
};

// ─── Events ──────────────────────────────────────────────────
export interface OControlEvent {
  type: 'state.changed';
  state: OControlState;
}

// ─── Command contracts ──────────────────────────────────────
export interface CommandRequest {
  /** Raw ISCP command (e.g. 'PWR01') or high-level action */
  command: string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  /** Raw ISCP response if available */
  raw?: string;
}

// ─── Volume helpers ─────────────────────────────────────────
export interface VolumeRequest {
  /** 'up' | 'down' | number (0–100) */
  value: 'up' | 'down' | number;
}

export interface InputRequest {
  input: InputId;
}

export interface PlaybackRequest {
  action: PlaybackCommand;
}

// ─── Presets ─────────────────────────────────────────────────
export interface PresetStep {
  command: string;
  /** Delay after this step in ms (default 200) */
  delayMs?: number;
}

export interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  steps: PresetStep[];
}
