import { useState } from 'react';
import type { NowPlayingMeta, PlaybackStatus } from '@o-control/shared';

type Props = {
  playback: PlaybackStatus;
  nowPlaying: NowPlayingMeta;
  serviceUrl: string;
};

type ArtworkProps = {
  src: string | null;
};

function hashArtworkIdentity(value: string): string {
  let forwardHash = 0x811c9dc5;
  let reverseHash = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    forwardHash = Math.imul(forwardHash ^ value.charCodeAt(index), 0x01000193);
    reverseHash = Math.imul(reverseHash ^ value.charCodeAt(value.length - 1 - index), 0x01000193);
  }

  return `${(forwardHash >>> 0).toString(36)}-${(reverseHash >>> 0).toString(36)}`;
}

function Artwork({ src }: ArtworkProps) {
  const [failed, setFailed] = useState(false);

  if (src !== null && !failed) {
    return (
      <img
        src={src}
        alt="Cover artwork"
        className="artwork-image"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="artwork-placeholder"
      data-testid="artwork-placeholder"
      role="img"
      aria-label="Artwork unavailable"
    >
      <span aria-hidden="true" />
    </div>
  );
}

function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatTimeDisplay(timeStr: string): string {
  if (!timeStr) return '--:--';
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10) + hours * 60;
    return `${String(mins).padStart(2, '0')}:${parts[2]}`;
  }
  return timeStr;
}

export function NowPlaying({ playback, nowPlaying, serviceUrl }: Props) {
  const hasTitle = nowPlaying.title.trim().length > 0;
  const detail = [nowPlaying.artist, nowPlaying.album].filter(Boolean).join(' - ');
  const formatDetail = [nowPlaying.format, nowPlaying.sampleRate, nowPlaying.bitDepth].filter(Boolean).join(' / ');

  const currentSecs = parseTime(nowPlaying.currentTime);
  const totalSecs = parseTime(nowPlaying.totalTime);
  const progressPercent = totalSecs > 0 ? Math.min(100, Math.max(0, (currentSecs / totalSecs) * 100)) : 0;

  const artworkIdentity = nowPlaying.coverArtUrl
    ? hashArtworkIdentity(`${nowPlaying.title}\0${nowPlaying.artist}\0${nowPlaying.coverArtUrl}`)
    : null;
  const coverArtSrc = artworkIdentity
    ? `${serviceUrl}/cover-art?t=${artworkIdentity}`
    : null;

  return (
    <section className="now-playing" aria-label="Now playing">
      <div className="artwork-container" data-testid="artwork-frame">
        <Artwork key={coverArtSrc ?? 'artwork-unavailable'} src={coverArtSrc} />
      </div>

      <div className="progress-container">
        <span className="time-text">{formatTimeDisplay(nowPlaying.currentTime)}</span>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="time-text">{formatTimeDisplay(nowPlaying.totalTime)}</span>
      </div>

      <div className="track-copy">
        <p className="track-title" title={hasTitle ? nowPlaying.title : 'No track info'}>
          {hasTitle ? nowPlaying.title : 'No track info'}
        </p>
        {detail ? (
          <p className="track-detail" title={detail}>
            {detail}
          </p>
        ) : (
          <p className="track-detail muted-text">Metadata unavailable</p>
        )}
        {formatDetail ? <p className="track-format">{formatDetail}</p> : null}
      </div>
    </section>
  );
}
