import type { OControlState } from '@o-control/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { receiverState } from '../test/fixtures';
import { DesktopShell } from './DesktopShell';

const mocks = vi.hoisted(() => ({
  api: {
    state: null as unknown as OControlState,
    presets: [],
    serviceReachable: true,
    pendingCommand: null as string | null,
    error: null as string | null,
    connectionLabel: 'Connected',
    refresh: vi.fn(async () => undefined),
    command: vi.fn(async () => true),
  },
  manager: {
    status: { mode: 'external', url: 'http://localhost:8787', healthy: true, error: null },
    config: { serviceMode: 'external' },
    updateConfig: vi.fn(),
    isTauri: false,
  },
  shortcuts: {
    register: vi.fn(async () => []),
    unregister: vi.fn(async () => undefined),
    toggle: vi.fn(),
  },
}));

vi.mock('../ui/useOControlApi', () => ({ useOControlApi: () => mocks.api }));
vi.mock('../ui/useServiceManager', () => ({ useServiceManager: () => mocks.manager }));
vi.mock('../native/shortcuts', () => ({
  SHORTCUTS: [],
  registerDesktopShortcuts: mocks.shortcuts.register,
  unregisterDesktopShortcuts: mocks.shortcuts.unregister,
  toggleNativePopover: mocks.shortcuts.toggle,
}));
vi.mock('../components/NetList', () => ({
  NetList: () => <section aria-label="Library">Library unavailable</section>,
}));

describe('DesktopShell navigation', () => {
  beforeEach(() => {
    mocks.api.state = receiverState();
    mocks.api.presets = [];
    mocks.api.serviceReachable = true;
    mocks.api.pendingCommand = null;
    mocks.api.error = null;
    mocks.api.connectionLabel = 'Connected';
    mocks.api.refresh.mockClear();
    mocks.api.command.mockClear();
    mocks.manager.status = {
      mode: 'external',
      url: 'http://localhost:8787',
      healthy: true,
      error: null,
    };
    mocks.manager.config = { serviceMode: 'external' };
    mocks.manager.updateConfig.mockClear();
    mocks.manager.isTauri = false;
    mocks.shortcuts.register.mockClear();
    mocks.shortcuts.unregister.mockClear();
    mocks.shortcuts.toggle.mockClear();
  });

  it('keeps Volume and Input out of the default player', () => {
    render(<DesktopShell />);

    expect(screen.getByLabelText('Now playing')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Volume' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Input picker')).not.toBeInTheDocument();
    expect(screen.queryByText('Network')).not.toBeInTheDocument();
  });

  it('opens Volume and returns to Remote', () => {
    render(<DesktopShell />);

    fireEvent.click(screen.getByRole('button', { name: 'Volume' }));
    expect(screen.getByRole('region', { name: 'Volume' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remote' }));
    expect(screen.queryByRole('region', { name: 'Volume' })).not.toBeInTheDocument();
  });

  it('opens Input from Settings rather than the main rail', () => {
    render(<DesktopShell />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: /^Input source/ }));
    expect(screen.getByLabelText('Input picker')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('gridcell', { name: 'Network' }));
    expect(mocks.api.command).toHaveBeenCalledWith(
      '/commands/input',
      { input: 'net' },
      'input:net',
    );
  });

  it('isolates a Library failure and returns to the player', () => {
    render(<DesktopShell />);

    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    expect(screen.getByRole('region', { name: 'Library' })).toHaveTextContent('Library unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Remote' }));
    expect(screen.getByLabelText('Now playing')).toBeInTheDocument();
  });

  it('disables receiver actions offline but keeps Settings enabled', () => {
    mocks.api.serviceReachable = false;
    mocks.api.state = receiverState({ connected: false, playback: 'unknown' });
    render(<DesktopShell />);

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Volume' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeEnabled();
  });

  it('keeps playback enabled while only Power is pending', () => {
    mocks.api.pendingCommand = 'power';
    render(<DesktopShell />);

    expect(screen.getByRole('button', { name: 'Standby' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
  });
});
