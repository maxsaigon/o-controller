// ── DLNA Media Server ─────────────────────────────────────────

export interface DLNAServer {
  /** Unique service name (USN) from SSDP */
  id: string;
  /** Human-readable name (e.g. "MinimServer [NAS]") */
  friendlyName: string;
  /** Device description URL from SSDP LOCATION header */
  location: string;
  /** ContentDirectory control URL (absolute) */
  contentDirectoryUrl: string;
  /** AVTransport control URL on the renderer, if available */
  avTransportUrl?: string;
  /** IP address of the server */
  host: string;
}

// ── Content Directory Items ───────────────────────────────────

export interface DLNAContainer {
  id: string;
  parentId: string;
  title: string;
  type: 'container';
  childCount?: number;
  albumArtURI?: string;
}

export interface DLNAItem {
  id: string;
  parentId: string;
  title: string;
  type: 'item';
  artist?: string;
  album?: string;
  genre?: string;
  duration?: string;
  albumArtURI?: string;
  /** Direct URL to the media resource */
  resourceUrl?: string;
  /** MIME type (e.g. "audio/flac") */
  mimeType?: string;
  /** Sample rate (e.g. "96000") */
  sampleRate?: string;
  /** Bits per sample (e.g. "24") */
  bitsPerSample?: string;
  /** File size in bytes */
  size?: number;
}

export type DLNABrowseResult = (DLNAContainer | DLNAItem)[];

export interface BrowseResponse {
  items: DLNABrowseResult;
  totalMatches: number;
  numberReturned: number;
}

// ── Discovery Events ──────────────────────────────────────────

export interface DiscoveryEvents {
  serverFound: (server: DLNAServer) => void;
  serverLost: (id: string) => void;
}
