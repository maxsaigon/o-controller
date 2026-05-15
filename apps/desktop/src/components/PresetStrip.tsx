import type { PresetDefinition } from '@o-control/shared';

type Props = {
  presets: PresetDefinition[];
  pendingCommand: string | null;
  disabled: boolean;
  onRun: (id: string) => void;
};

function labelForPreset(preset: PresetDefinition) {
  return preset.id === 'stop' ? 'Standby' : preset.name;
}

export function PresetStrip({ presets, pendingCommand, disabled, onRun }: Props) {
  return (
    <section className="control-band">
      <div className="section-heading">
        <span>Presets</span>
      </div>
      <div className="preset-row">
        {presets.map((preset) => {
          const pending = pendingCommand === `preset:${preset.id}`;
          return (
            <button key={preset.id} className={preset.id === 'stop' ? 'standby-preset' : ''} type="button" disabled={disabled || pending} onClick={() => onRun(preset.id)}>
              {pending ? 'Running...' : labelForPreset(preset)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
