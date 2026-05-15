import { isTauri, invoke } from '@tauri-apps/api/core';
import { isRegistered, register, unregister } from '@tauri-apps/plugin-global-shortcut';

export type ShortcutId = 'volumeUp' | 'volumeDown' | 'mute' | 'playPause' | 'togglePopover';

export type ShortcutDefinition = {
  id: ShortcutId;
  accelerator: string;
  display: string;
  label: string;
};

export type ShortcutStatus = ShortcutDefinition & {
  registered: boolean;
  error: string | null;
};

export const SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'volumeUp',
    accelerator: 'CommandOrControl+Shift+ArrowUp',
    display: 'Cmd/Ctrl Shift Up',
    label: 'Volume up',
  },
  {
    id: 'volumeDown',
    accelerator: 'CommandOrControl+Shift+ArrowDown',
    display: 'Cmd/Ctrl Shift Down',
    label: 'Volume down',
  },
  {
    id: 'mute',
    accelerator: 'CommandOrControl+Shift+M',
    display: 'Cmd/Ctrl Shift M',
    label: 'Mute toggle',
  },
  {
    id: 'playPause',
    accelerator: 'CommandOrControl+Shift+Space',
    display: 'Cmd/Ctrl Shift Space',
    label: 'Play/pause',
  },
  {
    id: 'togglePopover',
    accelerator: 'CommandOrControl+Shift+O',
    display: 'Cmd/Ctrl Shift O',
    label: 'Show/hide popover',
  },
];

type ShortcutActions = Record<ShortcutId, () => void | Promise<void>>;

function statusFor(definition: ShortcutDefinition, registered: boolean, error: string | null): ShortcutStatus {
  return { ...definition, registered, error };
}

function asErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function toggleNativePopover() {
  if (!isTauri()) return;
  await invoke('toggle_main_window');
}

export async function showNativePopover() {
  if (!isTauri()) return;
  await invoke('show_main_window');
}

export async function registerDesktopShortcuts(actions: ShortcutActions): Promise<ShortcutStatus[]> {
  if (!isTauri()) {
    return SHORTCUTS.map((definition) => statusFor(definition, false, 'Native shortcuts require the Tauri shell.'));
  }

  const results: ShortcutStatus[] = [];

  for (const definition of SHORTCUTS) {
    try {
      const alreadyRegistered = await isRegistered(definition.accelerator);
      if (!alreadyRegistered) {
        await register(definition.accelerator, (event) => {
          if (event.state !== 'Pressed') return;
          void actions[definition.id]();
        });
      }
      results.push(statusFor(definition, true, null));
    } catch (err) {
      results.push(statusFor(definition, false, asErrorMessage(err)));
    }
  }

  return results;
}

export async function unregisterDesktopShortcuts() {
  if (!isTauri()) return;
  await unregister(SHORTCUTS.map((definition) => definition.accelerator));
}
