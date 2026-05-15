import type { PlaybackCommand, PlaybackStatus } from '@o-control/shared';
import { Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react';

type Props = {
  playback: PlaybackStatus;
  disabled: boolean;
  pendingCommand: string | null;
  onAction: (action: PlaybackCommand) => void;
};

export function PlaybackControls({ playback, disabled, pendingCommand, onAction }: Props) {
  const playPause: PlaybackCommand = playback === 'playing' ? 'pause' : 'play';
  const playPending = pendingCommand === `playback:${playPause}`;

  return (
    <section className="control-band playback-band" aria-label="Playback">
      <button className="round-button" type="button" title="Previous" disabled={disabled} onClick={() => onAction('previous')}>
        <SkipBack size={17} />
      </button>
      <button className="primary-play" type="button" title={playPause === 'pause' ? 'Pause' : 'Play'} disabled={disabled || playPending} onClick={() => onAction(playPause)}>
        {playPause === 'pause' ? <Pause size={20} /> : <Play size={20} />}
        <span>{playPending ? '...' : playback === 'playing' ? 'Pause' : 'Play'}</span>
      </button>
      <button className="round-button" type="button" title="Stop" disabled={disabled} onClick={() => onAction('stop')}>
        <Square size={15} />
      </button>
      <button className="round-button" type="button" title="Next" disabled={disabled} onClick={() => onAction('next')}>
        <SkipForward size={17} />
      </button>
    </section>
  );
}
