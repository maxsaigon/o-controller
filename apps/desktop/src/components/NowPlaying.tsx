import { useEffect, useState } from 'react';
import type { NowPlayingMeta, PlaybackStatus } from '@o-control/shared';

type Props = {
  playback: PlaybackStatus;
  nowPlaying: NowPlayingMeta;
  serviceUrl: string;
};

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

  const hasCoverArt = !!nowPlaying.coverArtUrl;
  const coverArtSrc = hasCoverArt
    ? `${serviceUrl}/cover-art?t=${encodeURIComponent(nowPlaying.title + nowPlaying.artist)}`
    : null;

  const [artFailed, setArtFailed] = useState(false);

  useEffect(() => {
    setArtFailed(false);
  }, [coverArtSrc]);

  const showCoverArt = coverArtSrc !== null && !artFailed;

  return (
    <section className="now-playing" aria-label="Now playing">
      <div className="artwork-container" data-testid="artwork-frame">
        {showCoverArt ? (
          <img
            src={coverArtSrc ?? undefined}
            alt="Cover artwork"
            className="artwork-image"
            onError={() => setArtFailed(true)}
          />
        ) : (
          <div
            className="artwork-placeholder"
            data-testid="artwork-placeholder"
            aria-label="Artwork unavailable"
          >
            <span aria-hidden="true" />
          </div>
        )}
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
