import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VolumeControl } from './VolumeControl';

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
});
