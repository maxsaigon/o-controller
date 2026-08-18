import { useEffect, useState, useRef } from 'react';
import { Minus, Plus, Volume2, VolumeX } from 'lucide-react';

type Props = {
  compact?: boolean;
  sliderLabel?: string;
  volume: number;
  muted: boolean;
  disabled: boolean;
  pending: boolean;
  onStepDown: () => void;
  onStepUp: () => void;
  onCommit: (volume: number) => Promise<boolean | void>;
  onMute: () => void;
};

export function VolumeControl({ compact = false, sliderLabel = 'Player volume', volume, muted, disabled, pending, onStepDown, onStepUp, onCommit, onMute }: Props) {
  const [draft, setDraft] = useState(volume);
  const [committing, setCommitting] = useState(false);
  const lastCommitted = useRef(volume);
  const commitInFlight = useRef(false);

  useEffect(() => {
    setDraft(volume);
    lastCommitted.current = volume;
  }, [volume]);

  const handleCommit = async () => {
    if (draft === lastCommitted.current || commitInFlight.current) return;
    const requestedVolume = draft;
    const confirmedAtStart = lastCommitted.current;
    commitInFlight.current = true;
    setCommitting(true);
    try {
      const succeeded = await onCommit(requestedVolume);
      if (succeeded === false) {
        setDraft(lastCommitted.current);
      } else if (lastCommitted.current === confirmedAtStart) {
        lastCommitted.current = requestedVolume;
      }
    } catch {
      setDraft(lastCommitted.current);
    } finally {
      commitInFlight.current = false;
      setCommitting(false);
    }
  };

  const controlsDisabled = disabled || pending || committing;

  if (compact) {
    return (
      <section className="player-volume" aria-label="Volume">
        <button className={`player-volume-mute ${muted ? 'active' : ''}`} type="button" title={muted ? 'Unmute' : 'Mute'} disabled={controlsDisabled} onClick={onMute}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          aria-label={sliderLabel}
          className="volume-slider"
          type="range"
          min="0"
          max="100"
          value={draft}
          disabled={controlsDisabled}
          onChange={(event) => setDraft(Number(event.currentTarget.value))}
          onPointerUp={() => void handleCommit()}
          onBlur={() => void handleCommit()}
          onKeyUp={(event) => { if (event.key === 'Enter') void handleCommit(); }}
        />
        <span>{draft}</span>
      </section>
    );
  }

  return (
    <section className="sheet-panel volume-sheet" aria-label="Volume">
      <div className="sheet-heading volume-heading">
        <h2>Volume</h2>
        <strong>{draft} {muted ? <span className="muted-text" style={{fontSize: '14px'}}>(Muted)</span> : ''}</strong>
      </div>
      <div className="volume-row">
        <button className="square-button" type="button" title="Volume down" disabled={controlsDisabled} onClick={onStepDown}>
          <Minus size={16} />
        </button>
        <input
          aria-label="Volume"
          className="volume-slider"
          type="range"
          min="0"
          max="100"
          value={draft}
          disabled={controlsDisabled}
          onChange={(event) => setDraft(Number(event.currentTarget.value))}
          onPointerUp={() => void handleCommit()}
          onBlur={() => void handleCommit()}
          onKeyUp={(event) => {
            if (event.key === 'Enter') void handleCommit();
          }}
        />
        <button className="square-button" type="button" title="Volume up" disabled={controlsDisabled} onClick={onStepUp}>
          <Plus size={16} />
        </button>
      </div>
      <button className={`mute-toggle ${muted ? 'active' : ''}`} type="button" disabled={controlsDisabled} onClick={onMute}>
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        <span>{muted ? 'Unmute' : 'Mute'}</span>
      </button>
    </section>
  );
}
