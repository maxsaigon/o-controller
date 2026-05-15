import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

type Props = {
  volume: number;
  muted: boolean;
  disabled: boolean;
  pending: boolean;
  onStepDown: () => void;
  onStepUp: () => void;
  onCommit: (volume: number) => void;
};

export function VolumeControl({ volume, muted, disabled, pending, onStepDown, onStepUp, onCommit }: Props) {
  const [draft, setDraft] = useState(volume);

  useEffect(() => {
    setDraft(volume);
  }, [volume]);

  return (
    <section className="control-band volume-band" aria-label="Volume">
      <div className="section-heading">
        <span>Volume</span>
        <strong className={muted ? 'muted-text' : ''}>{muted ? 'Muted' : draft}</strong>
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
          onPointerUp={() => onCommit(draft)}
          onKeyUp={(event) => {
            if (event.key === 'Enter') onCommit(draft);
          }}
        />
        <button className="square-button" type="button" title="Volume up" disabled={disabled || pending} onClick={onStepUp}>
          <Plus size={16} />
        </button>
      </div>
    </section>
  );
}
