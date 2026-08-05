import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VolumeControl } from './VolumeControl';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('VolumeControl', () => {
  it('returns to the last confirmed volume when commit fails', async () => {
    const onCommit = vi.fn(async () => false);
    render(
      <VolumeControl
        volume={22}
        muted={false}
        disabled={false}
        pending={false}
        onStepDown={vi.fn()}
        onStepUp={vi.fn()}
        onCommit={onCommit}
        onMute={vi.fn()}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Volume' });
    fireEvent.change(slider, { target: { value: '35' } });
    fireEvent.pointerUp(slider);

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(35));
    expect(slider).toHaveValue('22');
  });

  it('coalesces pointer and blur commits while disabling volume controls', async () => {
    const request = deferred<boolean>();
    const onCommit = vi.fn(() => request.promise);
    render(
      <VolumeControl
        volume={22}
        muted={false}
        disabled={false}
        pending={false}
        onStepDown={vi.fn()}
        onStepUp={vi.fn()}
        onCommit={onCommit}
        onMute={vi.fn()}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Volume' });
    fireEvent.change(slider, { target: { value: '35' } });
    fireEvent.pointerUp(slider);
    fireEvent.blur(slider);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(slider).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Volume down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Volume up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mute' })).toBeDisabled();

    await act(async () => {
      request.resolve(true);
    });
    await waitFor(() => expect(slider).toBeEnabled());
  });

  it('rolls an older failed commit back to the latest confirmed prop', async () => {
    const request = deferred<boolean>();
    const onCommit = vi.fn(() => request.promise);
    const callbacks = {
      onStepDown: vi.fn(),
      onStepUp: vi.fn(),
      onMute: vi.fn(),
    };
    const { rerender } = render(
      <VolumeControl
        volume={22}
        muted={false}
        disabled={false}
        pending={false}
        onCommit={onCommit}
        {...callbacks}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Volume' });
    fireEvent.change(slider, { target: { value: '35' } });
    fireEvent.pointerUp(slider);
    rerender(
      <VolumeControl
        volume={28}
        muted={false}
        disabled={false}
        pending={false}
        onCommit={onCommit}
        {...callbacks}
      />,
    );

    await act(async () => {
      request.resolve(false);
    });
    await waitFor(() => expect(slider).toHaveValue('28'));
  });

  it('restores local controls when a commit rejects', async () => {
    const request = deferred<boolean>();
    render(
      <VolumeControl
        volume={22}
        muted={false}
        disabled={false}
        pending={false}
        onStepDown={vi.fn()}
        onStepUp={vi.fn()}
        onCommit={() => request.promise}
        onMute={vi.fn()}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Volume' });
    fireEvent.change(slider, { target: { value: '35' } });
    fireEvent.pointerUp(slider);
    expect(slider).toBeDisabled();

    await act(async () => {
      request.reject(new Error('network unavailable'));
    });
    await waitFor(() => expect(slider).toBeEnabled());
    expect(slider).toHaveValue('22');
  });
});
