import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShortcutId } from './shortcuts';
import { registerDesktopShortcuts, SHORTCUTS } from './shortcuts';

type GlobalShortcutEvent = { state: string };

const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  isRegistered: vi.fn<(accelerator: string) => Promise<boolean>>(async () => false),
  register: vi.fn<(
    accelerator: string,
    callback: (event: GlobalShortcutEvent) => void,
  ) => Promise<void>>(async () => undefined),
  unregister: vi.fn<(accelerator: string | string[]) => Promise<void>>(async () => undefined),
  invoke: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: mocks.isTauri,
  invoke: mocks.invoke,
}));

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  isRegistered: mocks.isRegistered,
  register: mocks.register,
  unregister: mocks.unregister,
}));

function shortcutActions() {
  return Object.fromEntries(
    SHORTCUTS.map(({ id }) => [id, vi.fn(async () => undefined)]),
  ) as Record<ShortcutId, ReturnType<typeof vi.fn>>;
}

describe('registerDesktopShortcuts', () => {
  beforeEach(() => {
    mocks.isTauri.mockReset();
    mocks.isTauri.mockReturnValue(true);
    mocks.isRegistered.mockReset();
    mocks.isRegistered.mockResolvedValue(false);
    mocks.register.mockReset();
    mocks.register.mockResolvedValue(undefined);
    mocks.unregister.mockReset();
    mocks.unregister.mockResolvedValue(undefined);
  });

  it('keeps the browser preview behavior without touching native registration', async () => {
    mocks.isTauri.mockReturnValue(false);

    const statuses = await registerDesktopShortcuts(shortcutActions());

    expect(statuses).toHaveLength(SHORTCUTS.length);
    expect(statuses.every((status) => !status.registered && status.error?.includes('Tauri shell'))).toBe(true);
    expect(mocks.isRegistered).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.unregister).not.toHaveBeenCalled();
  });

  it('replaces an existing accelerator so the new shell callback owns it', async () => {
    const actions = shortcutActions();
    const callbacks = new Map<string, (event: GlobalShortcutEvent) => void>();
    mocks.isRegistered.mockImplementation(async (accelerator: string) => accelerator === SHORTCUTS[0].accelerator);
    mocks.register.mockImplementation(async (accelerator, callback) => {
      callbacks.set(accelerator, callback);
    });

    const statuses = await registerDesktopShortcuts(actions);

    expect(mocks.unregister).toHaveBeenCalledWith(SHORTCUTS[0].accelerator);
    expect(mocks.unregister.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.register.mock.invocationCallOrder[0],
    );
    expect(statuses[0]).toMatchObject({ registered: true, error: null });
    callbacks.get(SHORTCUTS[0].accelerator)?.({ state: 'Pressed' });
    expect(actions.volumeUp).toHaveBeenCalledTimes(1);
  });

  it('reports Failed instead of false success when replacing an existing accelerator fails', async () => {
    mocks.isRegistered.mockImplementation(async (accelerator: string) => accelerator === SHORTCUTS[0].accelerator);
    mocks.unregister.mockRejectedValueOnce(new Error('replacement denied'));

    const statuses = await registerDesktopShortcuts(shortcutActions());

    expect(statuses[0]).toMatchObject({ registered: false, error: 'replacement denied' });
    expect(mocks.register).not.toHaveBeenCalledWith(SHORTCUTS[0].accelerator, expect.any(Function));
  });
});
