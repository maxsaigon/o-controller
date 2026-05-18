import type { OControlState } from '@o-control/shared';
import { ListMusic, SlidersHorizontal, Volume2, VolumeX, Wifi } from 'lucide-react';
import { inputLabel } from './StatusHeader';

type Props = {
  state: OControlState;
  receiverAvailable: boolean;
  activePanel: 'input' | 'volume' | 'presets' | null;
  onOpenInput: () => void;
  onOpenVolume: () => void;
  onOpenSettings: () => void;
  onOpenPresets: () => void;
};

export function CommandBar({ state, receiverAvailable, activePanel, onOpenInput, onOpenVolume, onOpenSettings, onOpenPresets }: Props) {
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

      <button type="button" title="Settings" onClick={onOpenSettings}>
        <SlidersHorizontal size={18} />
        <span>Settings</span>
      </button>

      <button className={activePanel === 'presets' ? 'active' : ''} type="button" title="Presets" disabled={!receiverAvailable} onClick={onOpenPresets}>
        <ListMusic size={18} />
        <span>More</span>
      </button>
    </nav>
  );
}
