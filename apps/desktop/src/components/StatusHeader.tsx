import type { OControlState } from '@o-control/shared';

type Props = {
  state: OControlState;
  serviceReachable: boolean;
  connectionLabel: string;
  pendingCommand: string | null;
};

function inputLabel(input: OControlState['input']) {
  if (input === 'unknown') return 'Input --';
  if (input === 'bluetooth') return 'BT';
  return input.toUpperCase();
}

export function StatusHeader({ state, serviceReachable, connectionLabel, pendingCommand }: Props) {
  const statusClass = serviceReachable && state.connected ? 'connected' : serviceReachable ? 'warn' : 'offline';
  return (
    <header className="status-header">
      <div>
        <div className="eyebrow">O-Control</div>
        <h1>CR-N775</h1>
      </div>
      <div className="status-stack">
        <span className={`status-pill ${statusClass}`}>
          <span className="status-dot" />
          {connectionLabel}
        </span>
        <span className="receiver-summary">
          {inputLabel(state.input)} · Vol {state.volume}
          {pendingCommand ? ' · Pending' : ''}
        </span>
      </div>
    </header>
  );
}
