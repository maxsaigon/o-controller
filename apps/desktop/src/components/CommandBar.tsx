import type { OControlState } from '@o-control/shared';
import { Power, Volume2, VolumeX } from 'lucide-react';

type Props = {
  state: OControlState;
  disabled: boolean;
  receiverAvailable: boolean;
  pendingCommand: string | null;
  onPower: () => void;
  onMute: () => void;
};

export function CommandBar({ state, disabled, receiverAvailable, pendingCommand, onPower, onMute }: Props) {
  const powerPending = pendingCommand === 'power';
  const mutePending = pendingCommand === 'mute';

  return (
    <section className="control-band command-band" aria-label="Primary receiver controls">
      <button
        className={`icon-action power ${state.power === 'on' ? 'active' : ''}`}
        type="button"
        title={state.power === 'on' ? 'Standby' : 'Power on'}
        disabled={disabled || powerPending}
        onClick={onPower}
      >
        <Power size={18} />
        <span>{powerPending ? '...' : state.power === 'on' ? 'On' : 'Power'}</span>
      </button>

      <button
        className={`icon-action ${state.muted ? 'active danger' : ''}`}
        type="button"
        title={state.muted ? 'Unmute' : 'Mute'}
        disabled={!receiverAvailable || mutePending}
        onClick={onMute}
      >
        {state.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        <span>{mutePending ? '...' : state.muted ? 'Muted' : 'Mute'}</span>
      </button>

      <div className="power-state">
        <span>Power</span>
        <strong>{state.power === 'unknown' ? '--' : state.power === 'off' ? 'Standby' : 'On'}</strong>
      </div>
    </section>
  );
}
