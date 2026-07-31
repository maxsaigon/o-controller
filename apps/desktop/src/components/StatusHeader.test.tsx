import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { receiverState } from '../test/fixtures';
import { StatusHeader } from './StatusHeader';

describe('StatusHeader', () => {
  it('shows only a green dot for a connected receiver', () => {
    render(
      <StatusHeader
        state={receiverState()}
        serviceReachable
        pendingCommand={null}
        onPower={vi.fn()}
      />,
    );

    expect(screen.getByRole('status', { name: 'Receiver connected' })).toHaveClass('connected');
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(screen.queryByText('Network')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CR-N775' })).toBeInTheDocument();
  });

  it.each([
    { serviceReachable: false, connected: true },
    { serviceReachable: true, connected: false },
  ])('shows a red dot while offline', ({ serviceReachable, connected }) => {
    render(
      <StatusHeader
        state={receiverState({ connected })}
        serviceReachable={serviceReachable}
        pendingCommand={null}
        onPower={vi.fn()}
      />,
    );
    expect(screen.getByRole('status', { name: 'Receiver not connected' })).toHaveClass('offline');
  });

  it('keeps Power scoped to service availability and its own pending state', () => {
    const onPower = vi.fn();
    const { rerender } = render(
      <StatusHeader
        state={receiverState()}
        serviceReachable
        pendingCommand={null}
        onPower={onPower}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Standby' }));
    expect(onPower).toHaveBeenCalledOnce();

    rerender(
      <StatusHeader
        state={receiverState()}
        serviceReachable
        pendingCommand="power"
        onPower={onPower}
      />,
    );
    expect(screen.getByRole('button', { name: 'Standby' })).toBeDisabled();
  });
});
