import { readFileSync } from 'node:fs';
import type { OControlState } from '@o-control/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShortcutDefinition, ShortcutId, ShortcutStatus } from '../native/shortcuts';
import { receiverState } from '../test/fixtures';
import { DesktopShell } from './DesktopShell';

type ShortcutActions = Record<ShortcutId, () => void | Promise<void>>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const mocks = vi.hoisted(() => ({
  api: {
    state: null as unknown as OControlState,
    presets: [],
    serviceReachable: true,
    pendingCommand: null as string | null,
    pendingCommandFor: vi.fn((domain: string) => {
      const pending = mocks.api.pendingCommand;
      if (domain === 'volume') {
        return pending?.startsWith('volume:') || pending === 'mute' ? pending : null;
      }
      return pending === domain || pending?.startsWith(`${domain}:`) ? pending : null;
    }),
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
    definitions: [
      {
        id: 'volumeUp',
        accelerator: 'CommandOrControl+Shift+ArrowUp',
        display: 'Cmd/Ctrl Shift Up',
        label: 'Volume up',
      },
    ] satisfies ShortcutDefinition[],
    actions: [] as ShortcutActions[],
    register: vi.fn<(actions: ShortcutActions) => Promise<ShortcutStatus[]>>(async () => []),
    unregister: vi.fn<() => Promise<void>>(async () => undefined),
    toggle: vi.fn(),
  },
}));

const globalStyles = readFileSync('src/styles/global.css', 'utf8');

vi.mock('../ui/useOControlApi', () => ({ useOControlApi: () => mocks.api }));
vi.mock('../ui/useServiceManager', () => ({ useServiceManager: () => mocks.manager }));
vi.mock('../native/shortcuts', () => ({
  SHORTCUTS: mocks.shortcuts.definitions,
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
  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    mocks.api.state = receiverState();
    mocks.api.presets = [];
    mocks.api.serviceReachable = true;
    mocks.api.pendingCommand = null;
    mocks.api.pendingCommandFor.mockClear();
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
    mocks.shortcuts.actions = [];
    mocks.shortcuts.register.mockReset();
    mocks.shortcuts.register.mockImplementation(async (actions) => {
      mocks.shortcuts.actions.push(actions);
      return [{ ...mocks.shortcuts.definitions[0], registered: true, error: null }];
    });
    mocks.shortcuts.unregister.mockReset();
    mocks.shortcuts.unregister.mockResolvedValue(undefined);
    mocks.shortcuts.toggle.mockReset();
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

  it('shows the collected global shortcut registration diagnostics in Settings', async () => {
    mocks.shortcuts.register.mockImplementation(async (actions) => {
      mocks.shortcuts.actions.push(actions);
      return [{ ...mocks.shortcuts.definitions[0], registered: false, error: 'Already registered' }];
    });
    render(<DesktopShell />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(
      await screen.findByRole('status', { name: 'Volume up: Failed — Already registered' }),
    ).toBeInTheDocument();
  });

  it('registers shortcuts once while handlers follow the latest playback and service actions', async () => {
    const registration = deferred<ShortcutStatus[]>();
    const firstCommand = vi.fn(async () => true);
    const latestCommand = vi.fn(async () => true);
    mocks.api.command = firstCommand;
    mocks.shortcuts.register.mockImplementation(async (actions) => {
      mocks.shortcuts.actions.push(actions);
      return registration.promise;
    });
    const view = render(<DesktopShell />);

    await waitFor(() => expect(mocks.shortcuts.register).toHaveBeenCalledTimes(1));
    const registeredActions = mocks.shortcuts.actions[0];

    mocks.api.state = receiverState({ playback: 'paused' });
    mocks.api.command = latestCommand;
    mocks.manager.status = {
      mode: 'external',
      url: 'http://localhost:9876',
      healthy: true,
      error: null,
    };
    view.rerender(<DesktopShell />);

    expect(mocks.shortcuts.register).toHaveBeenCalledTimes(1);
    expect(mocks.shortcuts.unregister).not.toHaveBeenCalled();
    await registeredActions.playPause();
    await registeredActions.volumeUp();
    expect(firstCommand).not.toHaveBeenCalled();
    expect(latestCommand).toHaveBeenNthCalledWith(
      1,
      '/commands/playback',
      { action: 'play' },
      'playback:play',
    );
    expect(latestCommand).toHaveBeenNthCalledWith(
      2,
      '/commands/volume',
      { value: 'up' },
      'volume:up',
    );

    registration.resolve([
      { ...mocks.shortcuts.definitions[0], registered: true, error: null },
    ]);
  });

  it('serializes cleanup before a remount registers and ignores stale diagnostics', async () => {
    const firstRegistration = deferred<ShortcutStatus[]>();
    const cleanup = deferred<void>();
    const secondRegistration = deferred<ShortcutStatus[]>();
    mocks.shortcuts.register
      .mockImplementationOnce(async (actions) => {
        mocks.shortcuts.actions.push(actions);
        return firstRegistration.promise;
      })
      .mockImplementationOnce(async (actions) => {
        mocks.shortcuts.actions.push(actions);
        return secondRegistration.promise;
      });
    mocks.shortcuts.unregister.mockReturnValueOnce(cleanup.promise);

    const firstView = render(<DesktopShell />);
    await waitFor(() => expect(mocks.shortcuts.register).toHaveBeenCalledTimes(1));
    firstView.unmount();
    const secondView = render(<DesktopShell />);

    expect(mocks.shortcuts.register).toHaveBeenCalledTimes(1);
    expect(mocks.shortcuts.unregister).not.toHaveBeenCalled();

    firstRegistration.resolve([
      { ...mocks.shortcuts.definitions[0], registered: false, error: 'Stale failure' },
    ]);
    await waitFor(() => expect(mocks.shortcuts.unregister).toHaveBeenCalledTimes(1));
    expect(mocks.shortcuts.register).toHaveBeenCalledTimes(1);

    cleanup.resolve();
    await waitFor(() => expect(mocks.shortcuts.register).toHaveBeenCalledTimes(2));
    secondRegistration.resolve([
      { ...mocks.shortcuts.definitions[0], registered: true, error: null },
    ]);
    fireEvent.click(secondView.getByRole('button', { name: 'Settings' }));

    expect(
      await secondView.findByRole('status', { name: 'Volume up: Registered' }),
    ).toBeInTheDocument();
    expect(secondView.queryByRole('status', { name: /Stale failure/ })).not.toBeInTheDocument();
  });

  it('neutralizes stale handlers and recovers the next mount after cleanup rejects', async () => {
    const cleanup = deferred<void>();
    const oldCommand = vi.fn(async () => true);
    const newCommand = vi.fn(async () => true);
    mocks.api.command = oldCommand;
    mocks.shortcuts.unregister.mockReturnValueOnce(cleanup.promise);

    const firstView = render(<DesktopShell />);
    await waitFor(() => expect(mocks.shortcuts.register).toHaveBeenCalledTimes(1));
    const oldActions = mocks.shortcuts.actions[0];
    firstView.unmount();

    await oldActions.volumeUp();
    await oldActions.togglePopover();
    expect(oldCommand).not.toHaveBeenCalled();
    expect(mocks.shortcuts.toggle).not.toHaveBeenCalled();

    mocks.api.command = newCommand;
    const secondView = render(<DesktopShell />);
    await waitFor(() => expect(mocks.shortcuts.unregister).toHaveBeenCalledTimes(1));
    expect(mocks.shortcuts.register).toHaveBeenCalledTimes(1);

    cleanup.reject(new Error('bulk cleanup failed'));
    await waitFor(() => expect(mocks.shortcuts.register).toHaveBeenCalledTimes(2));
    const newActions = mocks.shortcuts.actions[1];
    await newActions.volumeUp();
    expect(newCommand).toHaveBeenCalledWith(
      '/commands/volume',
      { value: 'up' },
      'volume:up',
    );

    fireEvent.click(secondView.getByRole('button', { name: 'Settings' }));
    expect(
      await secondView.findByRole('status', { name: 'Volume up: Registered' }),
    ).toBeInTheDocument();
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

  it('keeps volume controls enabled while only Playback is pending', () => {
    mocks.api.pendingCommand = 'playback:pause';
    render(<DesktopShell />);

    fireEvent.click(screen.getByRole('button', { name: 'Volume' }));
    expect(screen.getByRole('button', { name: 'Volume down' })).toBeEnabled();
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeEnabled();
  });
});
