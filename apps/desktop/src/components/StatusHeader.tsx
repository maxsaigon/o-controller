import type { OControlState } from '@o-control/shared';
import { Power } from 'lucide-react';

type Props = {
  state: OControlState;
  serviceReachable: boolean;
  pendingCommand: string | null;
  onPower: () => void;
};

export function StatusHeader({ state, serviceReachable, pendingCommand, onPower }: Props) {
  const connected = serviceReachable && state.connected;
  const powerPending = pendingCommand === 'power';

  return (
    <header className="status-header">
      <span
        className={`status-dot ${connected ? 'connected' : 'offline'}`}
        role="status"
        aria-label={connected ? 'Receiver connected' : 'Receiver not connected'}
        title={connected ? 'Connected' : 'Not connected'}
      />

      <h1>CR-N775</h1>

      <button
        className={`header-icon-button power ${state.power === 'on' ? 'active' : ''}`}
        type="button"
        title={state.power === 'on' ? 'Standby' : 'Power on'}
        aria-label={state.power === 'on' ? 'Standby' : 'Power on'}
        disabled={!serviceReachable || powerPending}
        onClick={onPower}
      >
        <Power size={19} />
      </button>
    </header>
  );
}
