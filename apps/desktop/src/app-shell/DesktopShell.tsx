import { useEffect, useMemo, useState } from 'react';
import type { InputId, OControlState, PlaybackCommand, PresetDefinition } from '@o-control/shared';
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
import { useServiceManager } from '../ui/useServiceManager';

export function DesktopShell() {
  const serviceManager = useServiceManager();
  const serviceUrl = serviceManager.status?.url || 'http://localhost:8787';

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<'input' | 'volume' | 'presets' | null>(null);
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
    setActivePanel(null);
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
      <section className={`popover ${activePanel ? 'panel-active' : ''}`} aria-label="O-Control desktop companion">
        <StatusHeader
          state={state}
          serviceReachable={api.serviceReachable}
          connectionLabel={api.connectionLabel}
          pendingCommand={api.pendingCommand}
          onContext={() => {
            setSettingsOpen(true);
            setActivePanel(null);
          }}
          onPower={runPower}
        />

        {settingsOpen ? (
          <ServiceSettings
            serviceManager={serviceManager}
            serviceReachable={api.serviceReachable}
            error={serviceManager.status?.error || api.error}
            shortcutStatus={shortcutStatus}
            onBack={() => setSettingsOpen(false)}
            onTest={api.refresh}
          />
        ) : (
          <>
            <div className="player-view">
              <NowPlaying playback={state.playback} nowPlaying={state.nowPlaying} />

              <PlaybackControls
                playback={state.playback}
                disabled={!receiverAvailable}
                pendingCommand={api.pendingCommand}
                onAction={runPlayback}
              />

              {api.error ? <p className="inline-error">{api.error}</p> : null}
            </div>

            <div className="rail-dock">
              {activePanel === 'input' ? (
                <InputSelector
                  value={state.input}
                  disabled={!receiverAvailable}
                  pendingCommand={api.pendingCommand}
                  onChange={setInput}
                />
              ) : null}

              {activePanel === 'volume' ? (
                <VolumeControl
                  volume={state.volume}
                  disabled={!receiverAvailable}
                  muted={state.muted}
                  pending={(api.pendingCommand?.startsWith('volume') ?? false) || api.pendingCommand === 'mute'}
                  onStepDown={() => setVolume('down')}
                  onStepUp={() => setVolume('up')}
                  onCommit={setVolume}
                  onMute={runMute}
                />
              ) : null}

              {activePanel === 'presets' ? (
                <PresetStrip presets={presets} pendingCommand={api.pendingCommand} disabled={!receiverAvailable} onRun={runPreset} />
              ) : null}

              <CommandBar
                state={state}
                receiverAvailable={receiverAvailable}
                activePanel={activePanel}
                onOpenInput={() => setActivePanel(activePanel === 'input' ? null : 'input')}
                onOpenVolume={() => setActivePanel(activePanel === 'volume' ? null : 'volume')}
                onOpenSettings={() => {
                  setSettingsOpen(true);
                  setActivePanel(null);
                }}
                onOpenPresets={() => setActivePanel(activePanel === 'presets' ? null : 'presets')}
              />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
