import type { PlaybackQueueState } from '@o-control/shared';
import { Disc3 } from 'lucide-react';

type Props = {
  queue: PlaybackQueueState;
  clearing: boolean;
  onClear: () => void;
};

export function UpNext({ queue, clearing, onClear }: Props) {
  const upcoming = queue.currentIndex >= 0
    ? queue.items.slice(queue.currentIndex + 1, queue.currentIndex + 3)
    : [];

  return (
    <aside className="v2-up-next" aria-label="Up Next">
      <div className="v2-up-next-heading">
        <h3>Up Next</h3>
        {upcoming.length > 0 ? <button type="button" disabled={clearing} onClick={onClear}>{clearing ? 'Clearing…' : 'Clear'}</button> : null}
      </div>
      {upcoming.length > 0 ? (
        <div className="v2-up-next-list">
          {upcoming.map((track, offset) => (
            <div className="v2-up-next-row" key={`${track.resourceUrl}-${offset}`}>
              <span className="v2-up-next-art"><Disc3 size={18} /></span>
              <span><strong>{track.title || 'Untitled track'}</strong><small>{track.artist || track.album || 'MusicServer'}</small></span>
            </div>
          ))}
        </div>
      ) : (
        <p className="v2-up-next-empty">No more tracks in the current queue.</p>
      )}
    </aside>
  );
}
