import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpNext } from './UpNext';

describe('UpNext', () => {
  it('shows only tracks after the current queue item', () => {
    render(<UpNext clearing={false} onClear={vi.fn()} queue={{ currentIndex: 0, items: [
      { resourceUrl: 'http://nas/1.flac', title: 'Playing now', artist: 'Artist' },
      { resourceUrl: 'http://nas/2.flac', title: 'Next song', artist: 'Artist' },
      { resourceUrl: 'http://nas/3.flac', title: 'Later song', album: 'Album' },
    ] }} />);

    expect(screen.queryByText('Playing now')).not.toBeInTheDocument();
    expect(screen.getByText('Next song')).toBeVisible();
    expect(screen.getByText('Later song')).toBeVisible();
  });

  it('limits Up Next to two tracks', () => {
    render(<UpNext clearing={false} onClear={vi.fn()} queue={{ currentIndex: 0, items: [
      { resourceUrl: 'http://nas/1.flac', title: 'Playing now' },
      { resourceUrl: 'http://nas/2.flac', title: 'Next one' },
      { resourceUrl: 'http://nas/3.flac', title: 'Next two' },
      { resourceUrl: 'http://nas/4.flac', title: 'Hidden third' },
    ] }} />);

    expect(screen.getByText('Next one')).toBeVisible();
    expect(screen.getByText('Next two')).toBeVisible();
    expect(screen.queryByText('Hidden third')).not.toBeInTheDocument();
  });

  it('renders a clear empty queue state', () => {
    render(<UpNext clearing={false} onClear={vi.fn()} queue={{ currentIndex: 0, items: [{ resourceUrl: 'http://nas/1.flac' }] }} />);
    expect(screen.getByText('No more tracks in the current queue.')).toBeVisible();
  });
});
