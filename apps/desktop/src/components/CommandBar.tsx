import type { OControlState } from '@o-control/shared';
import { Home, Library, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';

type Props = {
  state: OControlState;
  receiverAvailable: boolean;
  activePanel: 'input' | 'volume' | 'list' | null;
  settingsOpen: boolean;
  onOpenRemote: () => void;
  onOpenVolume: () => void;
  onOpenSettings: () => void;
  onOpenList: () => void;
};

export function CommandBar({
  state,
  receiverAvailable,
  activePanel,
  settingsOpen,
  onOpenRemote,
  onOpenVolume,
  onOpenSettings,
  onOpenList,
}: Props) {
  return (
    <nav className="command-rail" aria-label="Primary actions">
      <button
        className={!settingsOpen && activePanel === null ? 'active' : ''}
        type="button"
        aria-label="Remote"
        aria-pressed={!settingsOpen && activePanel === null}
        onClick={onOpenRemote}
      >
        <Home size={18} />
        <span>Remote</span>
      </button>

      <button
        className={`${activePanel === 'volume' ? 'active' : ''} ${state.muted ? 'muted' : ''}`}
        type="button"
        aria-label="Volume"
        aria-describedby="command-volume-status"
        aria-pressed={activePanel === 'volume'}
        disabled={!receiverAvailable}
        onClick={onOpenVolume}
      >
        {state.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        <span id="command-volume-status">{state.muted ? 'Muted' : `Vol ${state.volume}`}</span>
      </button>

      <button
        className={activePanel === 'list' ? 'active' : ''}
        type="button"
        aria-label="Library"
        aria-pressed={activePanel === 'list'}
        disabled={!receiverAvailable}
        onClick={onOpenList}
      >
        <Library size={18} />
        <span>Library</span>
      </button>

      <button
        className={settingsOpen ? 'active' : ''}
        type="button"
        aria-label="Settings"
        aria-pressed={settingsOpen}
        onClick={onOpenSettings}
      >
        <SlidersHorizontal size={18} />
        <span>Settings</span>
      </button>
    </nav>
  );
}
