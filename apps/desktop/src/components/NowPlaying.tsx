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

export function getCoverArtSrc(nowPlaying: NowPlayingMeta, serviceUrl: string): string | null {
  if (!nowPlaying.coverArtUrl) return null;
  const artworkIdentity = hashArtworkIdentity(
    `${nowPlaying.title}\0${nowPlaying.artist}\0${nowPlaying.coverArtUrl}`,
  );
  return `${serviceUrl}/cover-art?t=${artworkIdentity}`;
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
  if (!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(timeStr)) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatTimeDisplay(timeStr: string): string {
  if (!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(timeStr)) return '--:--';
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
  const artist = nowPlaying.artist.trim();
  const album = nowPlaying.album.trim();
  const trackNumber = /^\d+$/.test(nowPlaying.trackNumber.trim()) ? nowPlaying.trackNumber.trim() : '';

  const currentSecs = parseTime(nowPlaying.currentTime);
  const totalSecs = parseTime(nowPlaying.totalTime);
  const progressPercent = totalSecs > 0 ? Math.min(100, Math.max(0, (currentSecs / totalSecs) * 100)) : 0;

  const coverArtSrc = getCoverArtSrc(nowPlaying, serviceUrl);
  const playbackLabel = playback === 'playing'
    ? 'Now playing'
    : playback === 'paused'
      ? 'Paused'
      : 'Ready to play';

  return (
    <section className="now-playing" aria-label="Now playing">
      <div className="artwork-container" data-testid="artwork-frame">
        {coverArtSrc ? <img className="artwork-ambient" src={coverArtSrc} alt="" aria-hidden="true" /> : null}
        <div className="artwork-surface">
          <Artwork key={coverArtSrc ?? 'artwork-unavailable'} src={coverArtSrc} />
        </div>
      </div>

      <div className="track-copy">
        <div className={`playback-state ${playback === 'playing' ? 'is-playing' : ''}`}>
          <span aria-hidden="true" />
          {playbackLabel}
        </div>
        <p className="track-title" title={hasTitle ? nowPlaying.title : 'No track info'}>
          {hasTitle ? nowPlaying.title : 'No track info'}
        </p>
        <p className="track-artist" title={artist || 'Unknown artist'}>{artist || 'Unknown artist'}</p>
        <p className="track-album" title={album || 'Album metadata unavailable'}>
          {album || 'Album metadata unavailable'}
          {trackNumber ? <span> · Track {trackNumber}</span> : null}
        </p>
      </div>

      <div className="progress-container">
        <div
          className="progress-bar-bg"
          role="progressbar"
          aria-label="Track progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPercent)}
        >
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="progress-time-row">
          <span className="time-text">{formatTimeDisplay(nowPlaying.currentTime)}</span>
          <span className="time-text">{formatTimeDisplay(nowPlaying.totalTime)}</span>
        </div>
      </div>
    </section>
  );
}
