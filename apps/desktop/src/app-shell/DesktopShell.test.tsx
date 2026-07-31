import { readFileSync } from 'node:fs';
import type { OControlState } from '@o-control/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  netListProps: null as null | {
    state: OControlState;
    pendingCommand: string | null;
    command: unknown;
    serviceUrl: string;
  },
  shortcuts: {
    register: vi.fn(async () => []),
    unregister: vi.fn(async () => undefined),
    toggle: vi.fn(),
  },
}));

const globalStyles = readFileSync('src/styles/global.css', 'utf8');

vi.mock('../ui/useOControlApi', () => ({ useOControlApi: () => mocks.api }));
vi.mock('../ui/useServiceManager', () => ({ useServiceManager: () => mocks.manager }));
vi.mock('../native/shortcuts', () => ({
  SHORTCUTS: [],
  registerDesktopShortcuts: mocks.shortcuts.register,
  unregisterDesktopShortcuts: mocks.shortcuts.unregister,
  toggleNativePopover: mocks.shortcuts.toggle,
}));
vi.mock('../components/NetList', () => ({
  NetList: (props: NonNullable<typeof mocks.netListProps>) => {
    mocks.netListProps = props;
    return <section aria-label="Library">Library unavailable</section>;
  },
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
    mocks.api.command.mockReset();
    mocks.api.command.mockImplementation(async () => true);
    mocks.manager.status = {
      mode: 'external',
      url: 'http://localhost:8787',
      healthy: true,
      error: null,
    };
    mocks.manager.config = { serviceMode: 'external' };
    mocks.manager.updateConfig.mockClear();
    mocks.manager.isTauri = false;
    mocks.netListProps = null;
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

  it('exposes the active destination and current volume to assistive technology', () => {
    render(<DesktopShell />);

    const remote = screen.getByRole('button', { name: 'Remote' });
    const volume = screen.getByRole('button', { name: 'Volume' });
    const library = screen.getByRole('button', { name: 'Library' });
    const settings = screen.getByRole('button', { name: 'Settings' });
    expect(remote).toHaveAttribute('aria-pressed', 'true');
    expect(remote).toHaveClass('active');
    expect(volume).toHaveAttribute('aria-pressed', 'false');
    expect(volume).not.toHaveClass('active');
    expect(volume).toHaveAccessibleDescription('Vol 22');
    expect(library).toHaveAttribute('aria-pressed', 'false');
    expect(settings).toHaveAttribute('aria-pressed', 'false');
  });

  it('describes muted volume without changing the stable navigation name', () => {
    mocks.api.state = receiverState({ muted: true });
    render(<DesktopShell />);

    expect(screen.getByRole('button', { name: 'Volume' })).toHaveAccessibleDescription('Muted');
  });

  it('opens Volume and returns to Remote', () => {
    render(<DesktopShell />);

    const volume = screen.getByRole('button', { name: 'Volume' });
    fireEvent.click(volume);
    expect(volume).toHaveAttribute('aria-pressed', 'true');
    expect(volume).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Remote' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('region', { name: 'Volume' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remote' }));
    expect(screen.queryByRole('region', { name: 'Volume' })).not.toBeInTheDocument();
  });

  it('opens Input from Settings rather than the main rail', () => {
    render(<DesktopShell />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveClass('active');
    fireEvent.click(screen.getByRole('button', { name: /^Input source/ }));
    expect(screen.getByLabelText('Input picker')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('gridcell', { name: 'Network' }));
    expect(mocks.api.command).toHaveBeenCalledWith(
      '/commands/input',
      { input: 'net' },
      'input:net',
    );
  });

  it('keeps Input open on failure and closes it after a successful retry', async () => {
    mocks.api.command.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<DesktopShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: /^Input source/ }));

    fireEvent.click(screen.getByRole('gridcell', { name: 'Network' }));
    await waitFor(async () => {
      await Promise.resolve();
      expect(screen.getByLabelText('Input picker')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('gridcell', { name: 'Network' }));
    await waitFor(() => {
      expect(screen.queryByLabelText('Input picker')).not.toBeInTheDocument();
    });
  });

  it('isolates a Library failure and returns to the player', () => {
    mocks.api.pendingCommand = 'list:query';
    render(<DesktopShell />);

    const library = screen.getByRole('button', { name: 'Library' });
    fireEvent.click(library);
    expect(library).toHaveAttribute('aria-pressed', 'true');
    expect(library).toHaveClass('active');
    expect(screen.getByRole('region', { name: 'Library' })).toHaveTextContent('Library unavailable');
    expect(mocks.netListProps).toEqual({
      state: mocks.api.state,
      pendingCommand: 'list:query',
      command: mocks.api.command,
      serviceUrl: 'http://localhost:8787',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remote' }));
    expect(screen.queryByRole('region', { name: 'Library' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Now playing')).toBeInTheDocument();
  });

  it('uses a separate panel dock without duplicating the command rail dock', () => {
    const { container } = render(<DesktopShell />);

    expect(container.querySelectorAll('.panel-dock')).toHaveLength(0);
    expect(container.querySelectorAll('.rail-dock')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Volume' }));
    expect(container.querySelectorAll('.panel-dock')).toHaveLength(1);
    expect(container.querySelectorAll('.rail-dock')).toHaveLength(1);
    expect(globalStyles).toMatch(
      /\.popover\.panel-active\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto auto;/,
    );
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
