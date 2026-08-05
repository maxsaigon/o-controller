import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShortcutStatus } from '../native/shortcuts';
import type { ReceiverDevice, ServiceConfig } from '../ui/useServiceManager';
import { ServiceSettings } from './ServiceSettings';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const devices: ReceiverDevice[] = [
  {
    id: 'living-room',
    name: 'Living Room',
    host: '192.168.1.104',
    port: 60128,
    source: 'manual',
  },
];

const shortcutStatus: ShortcutStatus[] = [
  {
    id: 'volumeUp',
    accelerator: 'CommandOrControl+Shift+ArrowUp',
    display: 'Cmd/Ctrl Shift Up',
    label: 'Volume up',
    registered: true,
    error: null,
  },
  {
    id: 'mute',
    accelerator: 'CommandOrControl+Shift+M',
    display: 'Cmd/Ctrl Shift M',
    label: 'Mute toggle',
    registered: false,
    error: 'Shortcut is already in use',
  },
];

function renderSettings(config: ServiceConfig = { serviceMode: 'local', devices }) {
  const updateConfig = vi.fn(async () => undefined);
  const serviceManager = {
    status: null,
    config,
    updateConfig,
    isTauri: true,
  };

  const view = render(
    <ServiceSettings
      serviceManager={serviceManager}
      serviceReachable
      error={null}
      shortcutStatus={shortcutStatus}
      onBack={vi.fn()}
      onTest={vi.fn()}
      onOpenInput={vi.fn()}
    />,
  );

  return { ...view, updateConfig };
}

describe('ServiceSettings accessibility', () => {
  it('announces registered and failed global shortcut diagnostics', () => {
    renderSettings();

    expect(screen.getByRole('heading', { name: 'Global shortcuts' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Volume up: Registered' })).toHaveTextContent('Registered');
    expect(
      screen.getByRole('status', { name: 'Mute toggle: Failed — Shortcut is already in use' }),
    ).toHaveTextContent('Failed');
  });

  it('offers saved-device selection as a keyboard-focusable button with separate named actions', () => {
    const { container, updateConfig } = renderSettings();

    const selectDevice = screen.getByRole('button', { name: 'Use Living Room receiver' });
    selectDevice.focus();
    expect(document.activeElement).toBe(selectDevice);
    expect(selectDevice).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Edit Living Room' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Living Room' })).toBeInTheDocument();
    expect(container.querySelector('button button')).toBeNull();

    fireEvent.click(selectDevice);

    expect(updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ activeDeviceId: 'living-room' }),
    );
  });
});
