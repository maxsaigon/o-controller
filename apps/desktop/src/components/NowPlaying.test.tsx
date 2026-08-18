import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { receiverState } from '../test/fixtures';
import { NowPlaying } from './NowPlaying';

describe('NowPlaying', () => {
  it('does not repeat source quality below the track metadata', () => {
    render(<NowPlaying playback="playing" nowPlaying={receiverState().nowPlaying} serviceUrl="http://localhost:8787" />);
    expect(document.querySelector('.track-format')).toBeNull();
  });
  it('renders cover art inside the stable artwork frame', () => {
    const state = receiverState();
    render(
      <NowPlaying
        playback={state.playback}
        nowPlaying={state.nowPlaying}
        serviceUrl="http://localhost:8787"
      />,
    );
    expect(screen.getByTestId('artwork-frame')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Cover artwork' })).toBeInTheDocument();
  });

  it('gives track identity and progress an accessible hierarchy', () => {
    const state = receiverState({ nowPlaying: { trackNumber: '5' } });
    render(
      <NowPlaying playback={state.playback} nowPlaying={state.nowPlaying} serviceUrl="http://localhost:8787" />,
    );

    expect(screen.queryByRole('heading', { name: 'Now Playing' })).not.toBeInTheDocument();
    expect(screen.getByText('Now playing')).toBeVisible();
    expect(screen.getByText('Blue in Green')).toHaveClass('track-title');
    expect(screen.getByText('Miles Davis')).toHaveClass('track-artist');
    expect(screen.getByText(/Kind of Blue/)).toHaveTextContent('Kind of Blue · Track 5');
    expect(screen.getByRole('progressbar', { name: 'Track progress' })).toHaveAttribute('aria-valuenow', '31');
  });

  it('falls back to the fixed placeholder when the image fails', () => {
    const state = receiverState();
    render(
      <NowPlaying
        playback={state.playback}
        nowPlaying={state.nowPlaying}
        serviceUrl="http://localhost:8787"
      />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Cover artwork' }));
    expect(screen.getByTestId('artwork-placeholder')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Artwork unavailable' })).toBeInTheDocument();
  });

  it('recovers immediately when cover art changes for the same track', () => {
    const firstState = receiverState({ nowPlaying: { coverArtUrl: '/cover-art/first' } });
    const { rerender } = render(
      <NowPlaying
        playback={firstState.playback}
        nowPlaying={firstState.nowPlaying}
        serviceUrl="http://localhost:8787"
      />,
    );
    const firstImage = screen.getByRole('img', { name: 'Cover artwork' });
    const firstSrc = firstImage.getAttribute('src');
    fireEvent.error(firstImage);

    const nextState = receiverState({ nowPlaying: { coverArtUrl: '/cover-art/next' } });
    rerender(
      <NowPlaying
        playback={nextState.playback}
        nowPlaying={nextState.nowPlaying}
        serviceUrl="http://localhost:8787"
      />,
    );

    const nextImage = screen.getByRole('img', { name: 'Cover artwork' });
    expect(nextImage.getAttribute('src')).not.toBe(firstSrc);
  });

  it('uses a bounded opaque cache identity for large embedded artwork', () => {
    const firstPayload = 'A'.repeat(16_384);
    const firstState = receiverState({
      nowPlaying: { coverArtUrl: `data:image/jpeg;base64,${firstPayload}` },
    });
    const { rerender } = render(
      <NowPlaying
        playback={firstState.playback}
        nowPlaying={firstState.nowPlaying}
        serviceUrl="http://localhost:8787"
      />,
    );
    const firstSrc = screen.getByRole('img', { name: 'Cover artwork' }).getAttribute('src') ?? '';

    const nextPayload = `B${firstPayload}`;
    const nextState = receiverState({
      nowPlaying: { coverArtUrl: `data:image/jpeg;base64,${nextPayload}` },
    });
    rerender(
      <NowPlaying
        playback={nextState.playback}
        nowPlaying={nextState.nowPlaying}
        serviceUrl="http://localhost:8787"
      />,
    );
    const nextSrc = screen.getByRole('img', { name: 'Cover artwork' }).getAttribute('src') ?? '';
    const firstUrl = new URL(firstSrc);

    expect.soft(firstSrc.length).toBeLessThan(256);
    expect.soft(nextSrc.length).toBeLessThan(256);
    expect.soft(firstUrl.pathname).toBe('/cover-art');
    expect.soft(firstUrl.searchParams.get('t')).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    expect.soft(firstSrc).not.toContain('base64');
    expect.soft(firstSrc).not.toContain(firstPayload.slice(0, 512));
    expect.soft(nextSrc).not.toContain(nextPayload.slice(0, 513));
    expect(nextSrc).not.toBe(firstSrc);
  });

  it('retries artwork when a previously failed identity returns', () => {
    const firstState = receiverState({ nowPlaying: { coverArtUrl: '/cover-art/first' } });
    const { rerender } = render(
      <NowPlaying
        playback={firstState.playback}
        nowPlaying={firstState.nowPlaying}
        serviceUrl="http://localhost:8787"
      />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Cover artwork' }));
    expect(screen.getByRole('img', { name: 'Artwork unavailable' })).toBeInTheDocument();

    const nextState = receiverState({ nowPlaying: { coverArtUrl: '/cover-art/next' } });
    rerender(
      <NowPlaying
        playback={nextState.playback}
        nowPlaying={nextState.nowPlaying}
        serviceUrl="http://localhost:8787"
      />,
    );
    expect(screen.getByRole('img', { name: 'Cover artwork' })).toBeInTheDocument();

    rerender(
      <NowPlaying
        playback={firstState.playback}
        nowPlaying={firstState.nowPlaying}
        serviceUrl="http://localhost:8787"
      />,
    );
    expect(screen.getByRole('img', { name: 'Cover artwork' })).toBeInTheDocument();
  });

  it('ignores a stale error from artwork that has been replaced', () => {
    const firstState = receiverState({ nowPlaying: { coverArtUrl: '/cover-art/first' } });
    const { rerender } = render(
      <NowPlaying
        playback={firstState.playback}
        nowPlaying={firstState.nowPlaying}
        serviceUrl="http://localhost:8787"
      />,
    );
    const staleImage = screen.getByRole('img', { name: 'Cover artwork' });

    const nextState = receiverState({ nowPlaying: { coverArtUrl: '/cover-art/next' } });
    rerender(
      <NowPlaying
        playback={nextState.playback}
        nowPlaying={nextState.nowPlaying}
        serviceUrl="http://localhost:8787"
      />,
    );
    const currentImage = screen.getByRole('img', { name: 'Cover artwork' });
    expect(currentImage).not.toBe(staleImage);

    fireEvent.error(staleImage);
    expect(screen.getByRole('img', { name: 'Cover artwork' })).toBe(currentImage);
  });

  it('preserves full long metadata in accessible titles', () => {
    const longTitle = 'A very long track title that must not resize the player';
    const state = receiverState({ nowPlaying: { ...receiverState().nowPlaying, title: longTitle } });
    render(
      <NowPlaying
        playback={state.playback}
        nowPlaying={state.nowPlaying}
        serviceUrl="http://localhost:8787"
      />,
    );
    expect(screen.getByText(longTitle)).toHaveAttribute('title', longTitle);
  });

  it('renders a stable placeholder for malformed receiver time values', () => {
    const state = receiverState({
      nowPlaying: { ...receiverState().nowPlaying, currentTime: 'NaN:--', totalTime: 'invalid' },
    });
    render(
      <NowPlaying playback={state.playback} nowPlaying={state.nowPlaying} serviceUrl="http://localhost:8787" />,
    );

    expect(screen.getAllByText('--:--')).toHaveLength(2);
  });
});
