import { readFileSync } from 'node:fs';
import type { OControlState } from '@o-control/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShortcutDefinition, ShortcutId, ShortcutStatus } from '../native/shortcuts';
import { receiverState } from '../test/fixtures';
import type { ServiceConfig } from '../ui/useServiceManager';
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
    queue: { currentIndex: -1, items: [] },
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
    config: { serviceMode: 'external' } as ServiceConfig,
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
vi.mock('../components/LibraryHome', () => ({
  LibraryHome: ({ onOpenLibrary }: { onOpenLibrary: () => void }) => (
    <section aria-label="Home"><h2>Library Home</h2><button onClick={onOpenLibrary}>Browse from Home</button></section>
  ),
}));

describe('DesktopShell navigation', () => {
  function renderPlayerShell() {
    const view = render(<DesktopShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Player' }));
    return view;
  }

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

  it('opens on Home with the persistent player available', () => {
    render(<DesktopShell />);

    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Home' })).toHaveTextContent('Library Home');
    expect(screen.getByLabelText('Persistent player')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Blue in Green artwork' })).toHaveAttribute(
      'src',
      expect.stringMatching(/^http:\/\/localhost:8787\/cover-art\?t=/),
    );
    expect(screen.getByRole('slider', { name: 'Mini player volume' })).toHaveValue('22');
  });

  it('keeps the mini-player artwork fallback visible when cover art fails', () => {
    render(<DesktopShell />);

    const artwork = screen.getByRole('img', { name: 'Blue in Green artwork' });
    fireEvent.error(artwork);

    expect(artwork).not.toBeVisible();
    expect(document.querySelector('.v2-mini-art > span')).toBeVisible();
  });

  it('controls receiver volume from the mini player', async () => {
    render(<DesktopShell />);

    const slider = screen.getByRole('slider', { name: 'Mini player volume' });
    fireEvent.change(slider, { target: { value: '34' } });
    fireEvent.pointerUp(slider);

    await waitFor(() => expect(mocks.api.command).toHaveBeenCalledWith(
      '/commands/volume',
      { value: 34 },
      'volume:set',
    ));
  });

  it('opens Player with combined playback and volume controls', () => {
    renderPlayerShell();

    const player = screen.getByRole('button', { name: 'Player' });
    const library = screen.getByRole('button', { name: 'Library' });
    const settings = screen.getByRole('button', { name: 'Settings' });
    expect(player).toHaveAttribute('aria-pressed', 'true');
    expect(player).toHaveClass('active');
    expect(library).toHaveAttribute('aria-pressed', 'false');
    expect(settings).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Now playing')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Player volume' })).toHaveValue('22');
  });

  it('returns from Player to Home and opens Library from Home', () => {
    renderPlayerShell();

    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Home' })).toHaveTextContent('Library Home');
    expect(screen.getByLabelText('Persistent player')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Browse from Home' }));
    expect(screen.getByRole('region', { name: 'Library' })).toBeVisible();
  });

  it('shows the active device custom name only in Audio Signal', () => {
    mocks.manager.config = {
      serviceMode: 'external',
      activeDeviceId: 'living-room',
      devices: [{
        id: 'living-room',
        name: 'Studio Receiver',
        host: '192.168.1.104',
        port: 60128,
        source: 'manual',
      }],
    };

    renderPlayerShell();

    expect(screen.getByText('Studio Receiver')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Studio Receiver' })).not.toBeInTheDocument();
  });

  it('shows the configured DAC chip in Audio Signal', () => {
    mocks.manager.config = { serviceMode: 'external', digitalToAnalog: 'ESS Sabre 9038PRO' };
    renderPlayerShell();
    expect(screen.getByText('ESS Sabre 9038PRO')).toBeVisible();
  });

  it('surfaces each source-file metric independently', () => {
    mocks.api.state = receiverState({
      nowPlaying: { format: 'FLAC', sampleRate: '44.1kHz', bitDepth: '16bit', fileSize: 52428800 },
    });
    renderPlayerShell();

    const sourceFile = screen.getByLabelText('Playback information');
    expect(sourceFile).toHaveTextContent('CodecFLAC');
    expect(sourceFile).toHaveTextContent('Bit depth16bit');
    expect(sourceFile).toHaveTextContent('Sample rate44.1kHz');
    expect(sourceFile).toHaveTextContent('File size50 MB');
  });

  it('shows the mute state inside Player', () => {
    mocks.api.state = receiverState({ muted: true });
    renderPlayerShell();

    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
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

  it('keeps shortcut registration diagnostics out of Settings', async () => {
    mocks.shortcuts.register.mockImplementation(async (actions) => {
      mocks.shortcuts.actions.push(actions);
      return [{ ...mocks.shortcuts.definitions[0], registered: false, error: 'Already registered' }];
    });
    render(<DesktopShell />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    await waitFor(() => expect(mocks.shortcuts.register).toHaveBeenCalledOnce());
    expect(screen.queryByRole('heading', { name: 'Global shortcuts' })).not.toBeInTheDocument();
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
    expect(secondView.queryByRole('heading', { name: 'Global shortcuts' })).not.toBeInTheDocument();
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
    expect(secondView.queryByRole('heading', { name: 'Global shortcuts' })).not.toBeInTheDocument();
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
    expect(mocks.netListProps).toEqual(expect.objectContaining({
      state: mocks.api.state,
      pendingCommand: 'list:query',
      command: mocks.api.command,
      serviceUrl: 'http://localhost:8787',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Player' }));
    expect(screen.queryByRole('region', { name: 'Library' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Now playing')).toBeInTheDocument();
  });

  it('uses the V2 sidebar without a separate volume panel dock', () => {
    const { container } = renderPlayerShell();

    expect(container.querySelectorAll('.panel-dock')).toHaveLength(0);
    expect(container.querySelectorAll('.v2-sidebar')).toHaveLength(1);
    expect(container.querySelectorAll('.rail-dock')).toHaveLength(0);
    expect(screen.getByRole('slider', { name: 'Player volume' })).toBeInTheDocument();
    expect(container.querySelectorAll('.panel-dock')).toHaveLength(0);
    expect(container.querySelectorAll('.v2-sidebar')).toHaveLength(1);
    expect(globalStyles).toMatch(
      /\.v2-shell\s*\{[^}]*grid-template-columns:\s*228px minmax\(0,\s*1fr\);/,
    );
  });

  it('disables receiver actions offline but keeps Settings enabled', () => {
    mocks.api.serviceReachable = false;
    mocks.api.state = receiverState({ connected: false, playback: 'unknown' });
    renderPlayerShell();

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'Player volume' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeEnabled();
  });

  it('keeps playback enabled while only Power is pending', () => {
    mocks.api.pendingCommand = 'power';
    renderPlayerShell();

    expect(screen.getByRole('button', { name: 'Standby' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
  });

  it('keeps volume controls enabled while only Playback is pending', () => {
    mocks.api.pendingCommand = 'playback:pause';
    renderPlayerShell();

    expect(screen.getByRole('slider', { name: 'Player volume' })).toBeEnabled();
  });
});
