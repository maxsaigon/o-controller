import type { InputId, OControlState } from '@o-control/shared';
import { Bluetooth, Disc3, Music2, Radio, Usb, Waves } from 'lucide-react';

const INPUTS: Array<{ id: InputId; label: string; Icon: typeof Disc3 }> = [
  { id: 'cd', label: 'CD', Icon: Disc3 },
  { id: 'net', label: 'Network', Icon: Waves },
  { id: 'usb', label: 'USB', Icon: Usb },
  { id: 'bluetooth', label: 'Bluetooth', Icon: Bluetooth },
  { id: 'line', label: 'Line', Icon: Music2 },
  { id: 'tuner', label: 'Tuner', Icon: Radio },
];

type Props = {
  value: OControlState['input'];
  disabled: boolean;
  pendingCommand: string | null;
  onChange: (input: InputId) => void;
};

export function InputSelector({ value, disabled, pendingCommand, onChange }: Props) {
  const anyInputPending = pendingCommand?.startsWith('input:') ?? false;
  const selectedInput = INPUTS.find((input) => input.id === value);

  return (
    <section className="sheet-panel input-sheet" aria-label="Input picker">
      <div className="sheet-heading">
        <h2>Choose input</h2>
        <span>{selectedInput ? `${selectedInput.label} selected` : 'No input selected'}</span>
      </div>
      <div className="input-grid" role="grid" aria-label="Input selector">
        {INPUTS.map((input) => {
          const pending = pendingCommand === `input:${input.id}`;
          const selected = value === input.id;
          const Icon = input.Icon;
          return (
            <button
              key={input.id}
              className={selected ? 'selected' : ''}
              type="button"
              role="gridcell"
              aria-pressed={selected}
              disabled={disabled || anyInputPending}
              onClick={() => onChange(input.id)}
            >
              <Icon size={20} />
              <span>{pending ? 'Switching...' : input.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
