import type { NowPlayingMeta, PlaybackStatus } from '@o-control/shared';

type Props = {
  playback: PlaybackStatus;
  nowPlaying: NowPlayingMeta;
};

function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export function NowPlaying({ playback, nowPlaying }: Props) {
  const hasTitle = nowPlaying.title.trim().length > 0;
  const detail = [nowPlaying.artist, nowPlaying.album].filter(Boolean).join(' - ');
  const formatDetail = [nowPlaying.format, nowPlaying.sampleRate, nowPlaying.bitDepth].filter(Boolean).join(' / ');

  let playbackLabel = playback === 'unknown' ? 'Idle' : playback;
  if (!nowPlaying.title && playback === 'stopped') {
    playbackLabel = 'Stopped';
  }

  const currentSecs = parseTime(nowPlaying.currentTime);
  const totalSecs = parseTime(nowPlaying.totalTime);
  const progressPercent = totalSecs > 0 ? Math.min(100, Math.max(0, (currentSecs / totalSecs) * 100)) : 0;

  return (
    <section className="now-playing" aria-label="Now playing">
      <div className="artwork-container">
        {nowPlaying.coverArtUrl ? (
          <img src={nowPlaying.coverArtUrl} alt="Cover Artwork" className="artwork-image" />
        ) : (
          <div className="artwork-placeholder" aria-hidden="true">
            <span />
          </div>
        )}
      </div>

      <div className="progress-container">
        <span className="time-text">{nowPlaying.currentTime || '--:--'}</span>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="time-text">{nowPlaying.totalTime || '--:--'}</span>
      </div>

      <div className="track-copy">
        <p className="playback-status">{playbackLabel}</p>
        <p className="track-title">{hasTitle ? nowPlaying.title : 'No track info'}</p>
        {detail ? <p className="track-detail">{detail}</p> : <p className="track-detail muted-text">Metadata unavailable</p>}
        {formatDetail ? <p className="track-format">{formatDetail}</p> : null}
      </div>
    </section>
  );
}
