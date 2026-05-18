import type { OControlState } from '@o-control/shared';
import { Home, Power } from 'lucide-react';

type Props = {
  state: OControlState;
  serviceReachable: boolean;
  connectionLabel: string;
  pendingCommand: string | null;
  onContext: () => void;
  onPower: () => void;
};

export function inputLabel(input: OControlState['input']) {
  if (input === 'unknown') return 'Input --';
  if (input === 'bluetooth') return 'Bluetooth';
  if (input === 'net') return 'Network';
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function StatusHeader({ state, serviceReachable, connectionLabel, pendingCommand, onContext, onPower }: Props) {
  const statusClass = serviceReachable && state.connected ? 'connected' : serviceReachable ? 'warn' : 'offline';
  const powerPending = pendingCommand === 'power';
  const receiverName = state.connected ? 'CR-N775' : 'O-Control';

  return (
    <header className="status-header">
      <button className="header-icon-button" type="button" title="Settings" aria-label="Settings" onClick={onContext}>
        <Home size={19} />
      </button>

      <div className="header-center">
        <h1>{receiverName}</h1>
        <p>{inputLabel(state.input)}</p>
        <span className={`status-line ${statusClass}`}>
          <span className="status-dot" />
          {pendingCommand ? 'Updating' : connectionLabel}
        </span>
      </div>

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
