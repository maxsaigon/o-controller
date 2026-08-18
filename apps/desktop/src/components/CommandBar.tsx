import { Home, Library, PlayCircle, SlidersHorizontal } from 'lucide-react';

type Props = {
  receiverAvailable: boolean;
  activePanel: 'home' | 'input' | 'list' | null;
  settingsOpen: boolean;
  onOpenHome: () => void;
  onOpenPlayer: () => void;
  onOpenSettings: () => void;
  onOpenList: () => void;
};

export function CommandBar({
  receiverAvailable,
  activePanel,
  settingsOpen,
  onOpenHome,
  onOpenPlayer,
  onOpenSettings,
  onOpenList,
}: Props) {
  return (
    <nav className="command-rail" aria-label="Primary actions">
      <button
        className={!settingsOpen && activePanel === 'home' ? 'active' : ''}
        type="button"
        aria-label="Home"
        aria-pressed={!settingsOpen && activePanel === 'home'}
        onClick={onOpenHome}
      >
        <Home size={18} />
        <span>Home</span>
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
        className={!settingsOpen && activePanel === null ? 'active' : ''}
        type="button"
        aria-label="Player"
        aria-pressed={!settingsOpen && activePanel === null}
        onClick={onOpenPlayer}
      >
        <PlayCircle size={18} />
        <span>Player</span>
      </button>

      <button
        className={`settings-destination ${settingsOpen ? 'active' : ''}`}
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
