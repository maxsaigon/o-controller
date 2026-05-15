import type { NowPlayingMeta, PlaybackStatus } from '@o-control/shared';

type Props = {
  playback: PlaybackStatus;
  nowPlaying: NowPlayingMeta;
};

export function NowPlaying({ playback, nowPlaying }: Props) {
  const hasTitle = nowPlaying.title.trim().length > 0;
  const detail = [nowPlaying.artist, nowPlaying.album].filter(Boolean).join(' - ');
  const time = [nowPlaying.currentTime, nowPlaying.totalTime].filter(Boolean).join(' / ');

  return (
    <section className="now-playing" aria-label="Now playing">
      <div className="section-heading">
        <span>Now Playing</span>
        <strong>{playback === 'unknown' ? '--' : playback}</strong>
      </div>
      <p className="track-title">{hasTitle ? nowPlaying.title : 'No track info'}</p>
      {detail ? <p className="track-detail">{detail}</p> : <p className="track-detail muted-text">Metadata unavailable</p>}
      {time ? <p className="track-time">{time}</p> : null}
    </section>
  );
}
