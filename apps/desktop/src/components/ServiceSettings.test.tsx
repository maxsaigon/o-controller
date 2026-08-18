import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReceiverDevice, ServiceConfig } from '../ui/useServiceManager';
import type { ThemePreference } from '../ui/theme';
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

function renderSettings(config: ServiceConfig = { serviceMode: 'local', devices }) {
  const updateConfig = vi.fn(async () => undefined);
  const onThemeChange = vi.fn<(theme: ThemePreference) => void>();
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
      themePreference="auto"
      onThemeChange={onThemeChange}
      onBack={vi.fn()}
      onOpenInput={vi.fn()}
    />,
  );

  return { ...view, updateConfig, onThemeChange };
}

describe('ServiceSettings accessibility', () => {
  it('does not show shortcut diagnostics', () => {
    renderSettings();
    expect(screen.queryByRole('heading', { name: 'Global shortcuts' })).not.toBeInTheDocument();
  });

  it('saves the DAC chip name used by Audio Signal', () => {
    const { updateConfig } = renderSettings({ serviceMode: 'local', digitalToAnalog: 'AK4493' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Digital to Analog' }), {
      target: { value: 'ESS Sabre 9038PRO' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(updateConfig).toHaveBeenCalledWith(expect.objectContaining({
      digitalToAnalog: 'ESS Sabre 9038PRO',
    }));
  });

  it('offers automatic, light, and dark appearance choices', () => {
    const { onThemeChange } = renderSettings();

    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));

    expect(onThemeChange).toHaveBeenCalledWith('dark');
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

  it('saves a custom name for the active device', () => {
    const { updateConfig } = renderSettings({
      serviceMode: 'local',
      activeDeviceId: 'living-room',
      devices,
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Device name' }), {
      target: { value: 'Studio Receiver' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateConfig).toHaveBeenCalledWith(expect.objectContaining({
      devices: [expect.objectContaining({ id: 'living-room', name: 'Studio Receiver' })],
    }));
  });

  it('allows naming the receiver in browser preview without a saved device', () => {
    const { updateConfig } = renderSettings({ serviceMode: 'external' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Device name' }), {
      target: { value: 'Preview Receiver' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateConfig).toHaveBeenCalledWith(expect.objectContaining({
      deviceName: 'Preview Receiver',
    }));
  });
});
