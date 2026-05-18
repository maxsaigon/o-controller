import { useEffect, useState, useRef } from 'react';
import { Minus, Plus, Volume2, VolumeX } from 'lucide-react';

type Props = {
  volume: number;
  muted: boolean;
  disabled: boolean;
  pending: boolean;
  onStepDown: () => void;
  onStepUp: () => void;
  onCommit: (volume: number) => void;
  onMute: () => void;
};

export function VolumeControl({ volume, muted, disabled, pending, onStepDown, onStepUp, onCommit, onMute }: Props) {
  const [draft, setDraft] = useState(volume);
  const lastCommitted = useRef(volume);

  useEffect(() => {
    setDraft(volume);
    lastCommitted.current = volume;
  }, [volume]);

  const handleCommit = () => {
    if (draft !== lastCommitted.current) {
      lastCommitted.current = draft;
      onCommit(draft);
    }
  };

  return (
    <section className="sheet-panel volume-sheet" aria-label="Volume">
      <div className="sheet-heading volume-heading">
        <h2>Volume</h2>
        <strong>{draft} {muted ? <span className="muted-text" style={{fontSize: '14px'}}>(Muted)</span> : ''}</strong>
      </div>
      <div className="volume-row">
        <button className="square-button" type="button" title="Volume down" disabled={disabled || pending} onClick={onStepDown}>
          <Minus size={16} />
        </button>
        <input
          aria-label="Volume"
          className="volume-slider"
          type="range"
          min="0"
          max="100"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(Number(event.currentTarget.value))}
          onPointerUp={handleCommit}
          onBlur={handleCommit}
          onKeyUp={(event) => {
            if (event.key === 'Enter') handleCommit();
          }}
        />
        <button className="square-button" type="button" title="Volume up" disabled={disabled || pending} onClick={onStepUp}>
          <Plus size={16} />
        </button>
      </div>
      <button className={`mute-toggle ${muted ? 'active' : ''}`} type="button" disabled={disabled || pending} onClick={onMute}>
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        <span>{muted ? 'Unmute' : 'Mute'}</span>
      </button>
    </section>
  );
}
