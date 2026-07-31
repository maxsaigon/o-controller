import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { receiverState } from '../test/fixtures';
import { NowPlaying } from './NowPlaying';

describe('NowPlaying', () => {
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
});
