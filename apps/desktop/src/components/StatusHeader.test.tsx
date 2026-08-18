import { readFileSync } from 'node:fs';

import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { receiverState } from '../test/fixtures';
import { StatusHeader } from './StatusHeader';

const globalStyles = readFileSync('src/styles/global.css', 'utf8');
const styleElement = document.createElement('style');
styleElement.textContent = globalStyles;

beforeAll(() => {
  document.head.append(styleElement);
});

afterAll(() => {
  styleElement.remove();
});

function styleFor(selectorText: string): CSSStyleDeclaration {
  const normalizedSelector = selectorText.split(',').map((selector) => selector.trim()).join(',');
  const rule = Array.from(styleElement.sheet?.cssRules ?? []).find((candidate) => {
    const candidateSelector = (candidate as CSSStyleRule).selectorText;
    return (
      typeof candidateSelector === 'string' &&
      candidateSelector.split(',').map((selector) => selector.trim()).join(',') === normalizedSelector
    );
  });
  expect(rule).toBeDefined();
  return (rule as CSSStyleRule).style;
}

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

    expect(screen.getByRole('status', { name: 'Receiver on' })).toHaveClass('connected');
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(screen.queryByText('Network')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
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
    const status = screen.getByRole('status', { name: 'Receiver not connected' });
    expect(status).toHaveClass('offline');
  });

  it('shows a red dot when the connected receiver is in standby', () => {
    render(
      <StatusHeader
        state={receiverState({ power: 'off' })}
        serviceReachable
        pendingCommand={null}
        onPower={vi.fn()}
      />,
    );

    const status = screen.getByRole('status', { name: 'Receiver standby' });
    expect(status).toHaveClass('offline');
  });

  it('styles the connection dots', () => {
    expect(styleFor('.status-header').getPropertyValue('align-items')).toBe('center');
    expect(styleFor('.status-dot.connected').getPropertyValue('color')).toBe('#27a653');
    expect(styleFor('.status-dot.offline').getPropertyValue('color')).toBe('#d74848');
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
        state={receiverState({ connected: false })}
        serviceReachable
        pendingCommand={null}
        onPower={onPower}
      />,
    );
    expect(screen.getByRole('button', { name: 'Standby' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Standby' }));
    expect(onPower).toHaveBeenCalledTimes(2);

    rerender(
      <StatusHeader
        state={receiverState()}
        serviceReachable={false}
        pendingCommand={null}
        onPower={onPower}
      />,
    );
    expect(screen.getByRole('button', { name: 'Standby' })).toBeDisabled();

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
