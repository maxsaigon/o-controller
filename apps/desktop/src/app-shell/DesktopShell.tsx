import { useEffect, useMemo, useState } from 'react';
import type { InputId, OControlState, PlaybackCommand, PresetDefinition } from '@o-control/shared';
import { Settings, Wifi, WifiOff } from 'lucide-react';
import { CommandBar } from '../components/CommandBar';
import { InputSelector } from '../components/InputSelector';
import { NowPlaying } from '../components/NowPlaying';
import { PlaybackControls } from '../components/PlaybackControls';
import { PresetStrip } from '../components/PresetStrip';
import { ServiceSettings } from '../components/ServiceSettings';
import { StatusHeader } from '../components/StatusHeader';
import { VolumeControl } from '../components/VolumeControl';
import type { ShortcutStatus } from '../native/shortcuts';
import { registerDesktopShortcuts, SHORTCUTS, toggleNativePopover, unregisterDesktopShortcuts } from '../native/shortcuts';
import { useOControlApi } from '../ui/useOControlApi';

const DEFAULT_SERVICE_URL = 'http://localhost:8787';

export function DesktopShell() {
  const [serviceUrl, setServiceUrl] = useState(() => {
    return window.localStorage.getItem('o-control.serviceUrl') ?? DEFAULT_SERVICE_URL;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutStatus, setShortcutStatus] = useState<ShortcutStatus[]>(() => {
    return SHORTCUTS.map((shortcut) => ({ ...shortcut, registered: false, error: null }));
  });
  const api = useOControlApi(serviceUrl);

  const presets = useMemo<PresetDefinition[]>(() => {
    return api.presets.length > 0
      ? api.presets
      : [
          { id: 'work-jazz', name: 'Work Jazz', description: 'Start work listening', steps: [] },
          { id: 'focus-quiet', name: 'Focus Quiet', description: 'Lower volume', steps: [] },
          { id: 'stop', name: 'Standby', description: 'Stop playback and standby', steps: [] },
        ];
  }, [api.presets]);

  function updateServiceUrl(nextUrl: string) {
    const normalized = nextUrl.trim().replace(/\/$/, '');
    setServiceUrl(normalized);
    window.localStorage.setItem('o-control.serviceUrl', normalized);
  }

  async function runPower() {
    await api.command('/commands/power', { action: 'toggle' }, 'power');
  }

  async function runMute() {
    await api.command('/commands/mute', { action: 'toggle' }, 'mute');
  }

  async function runPlayback(action: PlaybackCommand) {
    await api.command('/commands/playback', { action }, `playback:${action}`);
  }

  async function setVolume(value: number | 'up' | 'down') {
    await api.command('/commands/volume', { value }, typeof value === 'number' ? 'volume:set' : `volume:${value}`);
  }

  async function setInput(input: InputId) {
    await api.command('/commands/input', { input }, `input:${input}`);
  }

  async function runPreset(id: string) {
    await api.command(`/presets/${id}/run`, {}, `preset:${id}`);
  }

  useEffect(() => {
    let cancelled = false;
    void registerDesktopShortcuts({
      volumeUp: () => setVolume('up'),
      volumeDown: () => setVolume('down'),
      mute: runMute,
      playPause: () => runPlayback(api.state.playback === 'playing' ? 'pause' : 'play'),
      togglePopover: toggleNativePopover,
    }).then((statuses) => {
      if (!cancelled) setShortcutStatus(statuses);
    });

    return () => {
      cancelled = true;
      void unregisterDesktopShortcuts();
    };
  }, [api.state.playback, serviceUrl]);

  const state: OControlState = api.state;
  const receiverAvailable = api.serviceReachable && state.connected;

  return (
    <main className="desktop-frame">
      <section className="popover" aria-label="O-Control desktop companion">
        <StatusHeader
          state={state}
          serviceReachable={api.serviceReachable}
          connectionLabel={api.connectionLabel}
          pendingCommand={api.pendingCommand}
        />

        {settingsOpen ? (
          <ServiceSettings
            serviceUrl={serviceUrl}
            serviceReachable={api.serviceReachable}
            error={api.error}
            shortcutStatus={shortcutStatus}
            onChangeServiceUrl={updateServiceUrl}
            onBack={() => setSettingsOpen(false)}
            onTest={api.refresh}
          />
        ) : (
          <>
            <CommandBar
              state={state}
              disabled={!api.serviceReachable}
              receiverAvailable={receiverAvailable}
              pendingCommand={api.pendingCommand}
              onPower={runPower}
              onMute={runMute}
            />

            <VolumeControl
              volume={state.volume}
              disabled={!receiverAvailable}
              muted={state.muted}
              pending={api.pendingCommand?.startsWith('volume') ?? false}
              onStepDown={() => setVolume('down')}
              onStepUp={() => setVolume('up')}
              onCommit={setVolume}
            />

            <PlaybackControls
              playback={state.playback}
              disabled={!receiverAvailable}
              pendingCommand={api.pendingCommand}
              onAction={runPlayback}
            />

            <InputSelector
              value={state.input}
              disabled={!receiverAvailable}
              pendingCommand={api.pendingCommand}
              onChange={setInput}
            />

            <PresetStrip presets={presets} pendingCommand={api.pendingCommand} disabled={!receiverAvailable} onRun={runPreset} />

            <NowPlaying playback={state.playback} nowPlaying={state.nowPlaying} />

            {api.error ? <p className="inline-error">{api.error}</p> : null}

            <footer className="footer-actions">
              <span className={`footer-connection ${api.serviceReachable ? 'online' : 'offline'}`}>
                {api.serviceReachable ? <Wifi size={14} /> : <WifiOff size={14} />}
                {api.connectionLabel}
              </span>
              <button className="ghost-button" type="button" onClick={() => setSettingsOpen(true)}>
                <Settings size={16} />
                Settings
              </button>
            </footer>
          </>
        )}
      </section>
    </main>
  );
}
