import type { OControlState } from '@o-control/shared';
import { ListMusic, SlidersHorizontal, Volume2, VolumeX, Wifi } from 'lucide-react';

type Props = {
  state: OControlState;
  receiverAvailable: boolean;
  activePanel: 'input' | 'volume' | 'list' | null;
  onOpenInput: () => void;
  onOpenVolume: () => void;
  onOpenSettings: () => void;
  onOpenList: () => void;
};

function inputLabel(input: OControlState['input']) {
  if (input === 'unknown') return 'Input --';
  if (input === 'bluetooth') return 'Bluetooth';
  if (input === 'net') return 'Network';
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function CommandBar({ state, receiverAvailable, activePanel, onOpenInput, onOpenVolume, onOpenSettings, onOpenList }: Props) {
  return (
    <nav className="command-rail" aria-label="Primary actions">
      <button
        className={activePanel === 'input' ? 'active' : ''}
        type="button"
        title="Choose input"
        disabled={!receiverAvailable}
        onClick={onOpenInput}
      >
        <Wifi size={18} />
        <span>{inputLabel(state.input)}</span>
      </button>

      <button
        className={`${activePanel === 'volume' ? 'active' : ''} ${state.muted ? 'muted' : ''}`}
        type="button"
        title="Volume"
        disabled={!receiverAvailable}
        onClick={onOpenVolume}
      >
        {state.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        <span>{state.muted ? 'Muted' : `Vol ${state.volume}`}</span>
      </button>

      <button className={activePanel === 'list' ? 'active' : ''} type="button" title="Music list" disabled={!receiverAvailable} onClick={onOpenList}>
        <ListMusic size={18} />
        <span>List</span>
      </button>

      <button type="button" title="Settings" onClick={onOpenSettings}>
        <SlidersHorizontal size={18} />
        <span>Settings</span>
      </button>


    </nav>
  );
}
