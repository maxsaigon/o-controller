import { useEffect, useMemo, useRef, useState } from 'react';
import type { InputId, OControlState, PlaybackCommand, PresetDefinition } from '@o-control/shared';
import { CommandBar } from '../components/CommandBar';
import { InputSelector } from '../components/InputSelector';
import { NowPlaying } from '../components/NowPlaying';
import { PlaybackControls } from '../components/PlaybackControls';
import { NetList } from '../components/NetList';
import { ServiceSettings } from '../components/ServiceSettings';
import { StatusHeader } from '../components/StatusHeader';
import { VolumeControl } from '../components/VolumeControl';
import type { ShortcutStatus } from '../native/shortcuts';
import { registerDesktopShortcuts, SHORTCUTS, toggleNativePopover, unregisterDesktopShortcuts } from '../native/shortcuts';
import { useOControlApi } from '../ui/useOControlApi';
import { useServiceManager } from '../ui/useServiceManager';

let shortcutLifecycleQueue: Promise<void> = Promise.resolve();

function enqueueShortcutLifecycle(task: () => Promise<void>): Promise<void> {
  const queued = shortcutLifecycleQueue.then(task);
  shortcutLifecycleQueue = queued.catch(() => {});
  return queued;
}

function shortcutRegistrationError(error: unknown): ShortcutStatus[] {
  const message = error instanceof Error ? error.message : String(error);
  return SHORTCUTS.map((shortcut) => ({ ...shortcut, registered: false, error: message }));
}

export function DesktopShell() {
  const serviceManager = useServiceManager();
  const serviceUrl = serviceManager.status?.url || 'http://localhost:8787';

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<'input' | 'volume' | 'list' | null>(null);
  const [shortcutStatus, setShortcutStatus] = useState<ShortcutStatus[]>(() => {
    return SHORTCUTS.map((shortcut) => ({ ...shortcut, registered: false, error: null }));
  });

  const api = useOControlApi(serviceUrl);
  const shortcutContext = useRef({ active: true, command: api.command, playback: api.state.playback });
  shortcutContext.current = { active: true, command: api.command, playback: api.state.playback };
  const pendingFor = (domain: string) => api.pendingCommandFor(domain);

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
    return api.command('/commands/volume', { value }, typeof value === 'number' ? 'volume:set' : `volume:${value}`);
  }

  async function setInput(input: InputId) {
    const succeeded = await api.command('/commands/input', { input }, `input:${input}`);
    if (succeeded) setActivePanel(null);
  }

  async function runPreset(id: string) {
    await api.command(`/presets/${id}/run`, {}, `preset:${id}`);
  }

  useEffect(() => {
    let active = true;
    let registrationStarted = false;
    const registration = enqueueShortcutLifecycle(async () => {
      if (!active) return;
      registrationStarted = true;
      try {
        const statuses = await registerDesktopShortcuts({
          volumeUp: async () => {
            if (!shortcutContext.current.active) return;
            await shortcutContext.current.command('/commands/volume', { value: 'up' }, 'volume:up');
          },
          volumeDown: async () => {
            if (!shortcutContext.current.active) return;
            await shortcutContext.current.command('/commands/volume', { value: 'down' }, 'volume:down');
          },
          mute: async () => {
            if (!shortcutContext.current.active) return;
            await shortcutContext.current.command('/commands/mute', { action: 'toggle' }, 'mute');
          },
          playPause: async () => {
            if (!shortcutContext.current.active) return;
            const action = shortcutContext.current.playback === 'playing' ? 'pause' : 'play';
            await shortcutContext.current.command('/commands/playback', { action }, `playback:${action}`);
          },
          togglePopover: async () => {
            if (!shortcutContext.current.active) return;
            await toggleNativePopover();
          },
        });
        if (active) setShortcutStatus(statuses);
      } catch (error) {
        if (active) setShortcutStatus(shortcutRegistrationError(error));
      }
    });
    void registration.catch(() => {});

    return () => {
      active = false;
      shortcutContext.current.active = false;
      const cleanup = enqueueShortcutLifecycle(async () => {
        if (registrationStarted) await unregisterDesktopShortcuts();
      });
      void cleanup.catch(() => {});
    };
  }, []);

  const state: OControlState = api.state;
  const receiverAvailable = api.serviceReachable && state.connected;

  return (
    <main className="desktop-frame">
      <section className={`popover ${activePanel ? 'panel-active' : ''}`} aria-label="O-Control desktop companion">
        <StatusHeader
          state={state}
          serviceReachable={api.serviceReachable}
          pendingCommand={pendingFor('power')}
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
            onOpenInput={() => {
              setSettingsOpen(false);
              setActivePanel('input');
            }}
          />
        ) : (
          <>
            <div className="player-view">
              <NowPlaying playback={state.playback} nowPlaying={state.nowPlaying} serviceUrl={serviceUrl} />

              <PlaybackControls
                playback={state.playback}
                disabled={!receiverAvailable}
                pendingCommand={pendingFor('playback')}
                onAction={runPlayback}
              />

              {api.error ? <p className="inline-error">{api.error}</p> : null}
            </div>

            {activePanel ? (
              <div className="panel-dock">
                {activePanel === 'input' ? (
                  <InputSelector
                    value={state.input}
                    disabled={!receiverAvailable}
                    pendingCommand={pendingFor('input')}
                    onChange={setInput}
                  />
                ) : null}

                {activePanel === 'volume' ? (
                  <VolumeControl
                    volume={state.volume}
                    disabled={!receiverAvailable}
                    muted={state.muted}
                    pending={pendingFor('volume') !== null}
                    onStepDown={() => setVolume('down')}
                    onStepUp={() => setVolume('up')}
                    onCommit={setVolume}
                    onMute={runMute}
                  />
                ) : null}

                {activePanel === 'list' ? (
                  <NetList
                    state={state}
                    pendingCommand={pendingFor('list') ?? pendingFor('input')}
                    command={api.command}
                    rawCommand={api.rawCommand}
                    serviceUrl={serviceUrl}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )}

        <div className="rail-dock">
          <CommandBar
            state={state}
            receiverAvailable={receiverAvailable}
            activePanel={activePanel}
            settingsOpen={settingsOpen}
            onOpenRemote={() => {
              setSettingsOpen(false);
              setActivePanel(null);
            }}
            onOpenVolume={() => {
              setSettingsOpen(false);
              setActivePanel(activePanel === 'volume' ? null : 'volume');
            }}
            onOpenSettings={() => {
              setSettingsOpen(true);
              setActivePanel(null);
            }}
            onOpenList={() => {
              setSettingsOpen(false);
              setActivePanel(activePanel === 'list' ? null : 'list');
            }}
          />
        </div>
      </section>
    </main>
  );
}
