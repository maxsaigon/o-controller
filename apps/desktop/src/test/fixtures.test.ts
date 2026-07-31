import { describe, expect, it } from 'vitest';

import { receiverState } from './fixtures';

describe('receiverState', () => {
  it('applies nested now-playing overrides without dropping fixture defaults', () => {
    const state = receiverState({
      nowPlaying: {
        title: 'So What',
      },
    });

    expect(state.nowPlaying.title).toBe('So What');
    expect(state.nowPlaying.artist).toBe('Miles Davis');
    expect(state.nowPlaying.album).toBe('Kind of Blue');
  });

  it('isolates net-list items between fixture instances and their overrides', () => {
    const emptyFirst = receiverState();
    const emptySecond = receiverState();
    const items = [{ index: 0, name: 'Music Server', type: 'folder' as const }];
    const first = receiverState({ netList: { items } });
    const second = receiverState({ netList: { items } });

    emptyFirst.netList.items.push({ index: 0, name: 'USB', type: 'folder' });
    first.netList.items[0].name = 'Changed';
    first.netList.items.push({ index: 1, name: 'USB', type: 'folder' });

    expect(emptySecond.netList.items).toEqual([]);
    expect(first.netList.items).not.toBe(items);
    expect(second.netList.items).not.toBe(items);
    expect(second.netList.items).toEqual([{ index: 0, name: 'Music Server', type: 'folder' }]);
    expect(items).toEqual([{ index: 0, name: 'Music Server', type: 'folder' }]);
  });
});
