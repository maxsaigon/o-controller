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
  currentTime: string;
  totalTime: string;
  trackNumber: string;
  coverArtUrl?: string;
  format?: string;
  sampleRate?: string;
  bitDepth?: string;
  fileSize?: number;
  repeat?: 'off' | 'one' | 'all' | 'unknown';
  shuffle?: 'off' | 'on' | 'unknown';
}

export interface NetListItem {
  index: number;
  name: string;
  type: 'folder' | 'file' | 'unknown';
}

export interface NetListState {
  title: string;
  items: NetListItem[];
  cursor: number;
  totalItems: number;
}

// ─── Music catalog ───────────────────────────────────────────
export interface MusicTrack {
  id: string;
  parentId: string;
  title: string;
  artist?: string;
  album?: string;
  albumId?: string;
  artistId?: string;
  trackNumber?: number;
  duration?: string;
  resourceUrl: string;
  mimeType?: string;
  albumArtUrl?: string;
}

export interface MusicAlbum {
  id: string;
  title: string;
  artist?: string;
  artistId?: string;
  albumArtUrl?: string;
  tracks: MusicTrack[];
}

export interface MusicArtist {
  id: string;
  name: string;
  albums: MusicAlbum[];
}

export interface MusicCatalog {
  albums: MusicAlbum[];
  artists: MusicArtist[];
}

export interface PlaybackQueueItem {
  resourceUrl: string;
  title?: string;
  artist?: string;
  album?: string;
  albumArtURI?: string;
  size?: number;
}

export interface PlaybackQueueState {
  currentIndex: number;
  items: PlaybackQueueItem[];
}

export interface OControlState {
  connected: boolean;
  power: 'on' | 'off' | 'unknown';
  input: InputId | 'unknown';
  volume: number;           // 0–100 (hex 0x00–0x64)
  muted: boolean;
  playback: PlaybackStatus;
  nowPlaying: NowPlayingMeta;
  netList: NetListState;
}

export const DEFAULT_NOW_PLAYING: NowPlayingMeta = {
  title: '',
  artist: '',
  album: '',
  currentTime: '',
  totalTime: '',
  trackNumber: '',
};

export const DEFAULT_NET_LIST: NetListState = {
  title: '',
  items: [],
  cursor: -1,
  totalItems: 0,
};

export const DEFAULT_STATE: OControlState = {
  connected: false,
  power: 'unknown',
  input: 'unknown',
  volume: 0,
  muted: false,
  playback: 'unknown',
  nowPlaying: { ...DEFAULT_NOW_PLAYING },
  netList: { ...DEFAULT_NET_LIST },
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
