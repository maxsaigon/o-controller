import type { InputId, OControlState } from '@o-control/shared';

const INPUTS: Array<{ id: InputId; label: string }> = [
  { id: 'cd', label: 'CD' },
  { id: 'net', label: 'NET' },
  { id: 'usb', label: 'USB' },
  { id: 'bluetooth', label: 'BT' },
  { id: 'line', label: 'Line' },
  { id: 'tuner', label: 'Tuner' },
];

type Props = {
  value: OControlState['input'];
  disabled: boolean;
  pendingCommand: string | null;
  onChange: (input: InputId) => void;
};

export function InputSelector({ value, disabled, pendingCommand, onChange }: Props) {
  return (
    <section className="control-band">
      <div className="section-heading">
        <span>Input</span>
        <strong>{value === 'unknown' ? '--' : value}</strong>
      </div>
      <div className="segmented" role="group" aria-label="Input selector">
        {INPUTS.map((input) => {
          const pending = pendingCommand === `input:${input.id}`;
          return (
            <button
              key={input.id}
              className={value === input.id ? 'selected' : ''}
              type="button"
              disabled={disabled || pending}
              onClick={() => onChange(input.id)}
            >
              {pending ? '...' : input.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
