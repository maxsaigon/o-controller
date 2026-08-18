import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioWaveform } from 'lucide-react';
import type { InputId, OControlState, PlaybackCommand, PresetDefinition } from '@o-control/shared';
import { CommandBar } from '../components/CommandBar';
import { InputSelector } from '../components/InputSelector';
import { LibraryHome } from '../components/LibraryHome';
import { getCoverArtSrc, NowPlaying } from '../components/NowPlaying';
import { PlaybackControls } from '../components/PlaybackControls';
import { NetList } from '../components/NetList';
import type { LibraryNavigationTarget } from '../components/NetList';
import { ServiceSettings } from '../components/ServiceSettings';
import { StatusHeader } from '../components/StatusHeader';
import { VolumeControl } from '../components/VolumeControl';
import { UpNext } from '../components/UpNext';

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes < 1) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unitIndex);
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}
import type { ShortcutStatus } from '../native/shortcuts';
import { registerDesktopShortcuts, SHORTCUTS, toggleNativePopover, unregisterDesktopShortcuts } from '../native/shortcuts';
import { useOControlApi } from '../ui/useOControlApi';
import { useServiceManager } from '../ui/useServiceManager';
import { useThemePreference } from '../ui/theme';

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
  const [themePreference, setThemePreference] = useThemePreference();
  const serviceUrl = serviceManager.status?.url || 'http://localhost:8787';

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<'home' | 'input' | 'list' | null>('home');
  const [libraryNavigationTarget, setLibraryNavigationTarget] = useState<LibraryNavigationTarget | null>(null);
  const [shortcutStatus, setShortcutStatus] = useState<ShortcutStatus[]>(() => {
    return SHORTCUTS.map((shortcut) => ({ ...shortcut, registered: false, error: null }));
  });

  const api = useOControlApi(serviceUrl);
  const activeDeviceName = serviceManager.config.devices?.find(
    (device) => device.id === serviceManager.config.activeDeviceId,
  )?.name || serviceManager.config.deviceName;
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
  const miniCoverArtSrc = getCoverArtSrc(state.nowPlaying, serviceUrl);

  return (
    <main className="desktop-frame v2-desktop-frame">
      <section className={`popover v2-shell ${activePanel ? 'panel-active' : ''}`} aria-label="O-Control Music Library V2">
        <aside className="v2-sidebar">
          <div className="v2-brand" aria-label="O-Control">
            <span className="v2-brand-mark" aria-hidden="true"><AudioWaveform size={24} /></span>
            <span><strong>O-Control</strong><small>MusicServer</small></span>
          </div>
          <CommandBar
            receiverAvailable={receiverAvailable}
            activePanel={activePanel}
            settingsOpen={settingsOpen}
            onOpenHome={() => {
              setSettingsOpen(false);
              setActivePanel('home');
            }}
            onOpenPlayer={() => {
              setSettingsOpen(false);
              setActivePanel(null);
            }}
            onOpenSettings={() => {
              setSettingsOpen(true);
              setActivePanel(null);
            }}
            onOpenList={() => {
              setSettingsOpen(false);
              setActivePanel('list');
            }}
          />
        </aside>

        <div className={`v2-workspace ${activePanel === null && !settingsOpen ? 'player-active' : ''}`}>
          <StatusHeader
            state={state}
            serviceReachable={api.serviceReachable}
            pendingCommand={pendingFor('power')}
            onPower={runPower}
          />

          <div className={`v2-content ${activePanel === null && !settingsOpen ? 'v2-player-content' : ''}`}>
          {settingsOpen ? (
          <ServiceSettings
            serviceManager={serviceManager}
            serviceReachable={api.serviceReachable}
            error={serviceManager.status?.error || api.error}
            themePreference={themePreference}
            onThemeChange={setThemePreference}
            onBack={() => setSettingsOpen(false)}
            onOpenInput={() => {
              setSettingsOpen(false);
              setActivePanel('input');
            }}
          />
        ) : (
          <>
            {activePanel === 'home' ? <LibraryHome serviceUrl={serviceUrl} serviceReachable={api.serviceReachable} onOpenLibrary={() => setActivePanel('list')} onNavigate={(target) => { setLibraryNavigationTarget(target); setActivePanel('list'); }} /> : null}
            <div className={`player-view ${activePanel === 'list' ? 'v2-library-view' : 'v2-player-page'} ${activePanel === 'home' || activePanel === 'input' ? 'v2-hidden-view' : ''}`}>
              {activePanel !== 'list' ? (
              <>
              <NowPlaying playback={state.playback} nowPlaying={state.nowPlaying} serviceUrl={serviceUrl} />

              <div className="v2-player-controls">
                <PlaybackControls
                  playback={state.playback}
                  disabled={!receiverAvailable}
                  pendingCommand={pendingFor('playback')}
                  onAction={runPlayback}
                />
                <VolumeControl
                  compact
                  volume={state.volume}
                  disabled={!receiverAvailable}
                  muted={state.muted}
                  pending={pendingFor('volume') !== null}
                  onStepDown={() => setVolume('down')}
                  onStepUp={() => setVolume('up')}
                  onCommit={setVolume}
                  onMute={runMute}
                />
              </div>
              <aside className="v2-signal-card" aria-label="Playback information">
                <div className="v2-signal-heading">
                  <span className="v2-signal-label">Source file</span>
                  <span className="v2-signal-live"><i aria-hidden="true" /> Live data</span>
                </div>
                <div className="v2-signal-metrics">
                  <div><span>Codec</span><strong>{state.nowPlaying.format || '—'}</strong></div>
                  <div><span>Bit depth</span><strong>{state.nowPlaying.bitDepth || '—'}</strong></div>
                  <div><span>Sample rate</span><strong>{state.nowPlaying.sampleRate || '—'}</strong></div>
                  <div><span>File size</span><strong>{formatFileSize(state.nowPlaying.fileSize) || '—'}</strong></div>
                </div>
                <div className="v2-signal-path">
                  <div><span>Digital-to-Analog</span><strong>{serviceManager.config.digitalToAnalog?.trim() || 'Not configured'}</strong></div>
                  <span className="v2-signal-path-line" aria-hidden="true" />
                  <div><span>Output device</span><strong>{activeDeviceName}</strong></div>
                </div>
              </aside>
              <UpNext
                queue={api.queue}
                clearing={pendingFor('queue') !== null}
                onClear={() => { void api.command('/dlna/queue/clear', {}, 'queue:clear'); }}
              />
              </>
              ) : null}

              {api.error ? <p className="inline-error">{api.error}</p> : null}
            </div>

            {activePanel === 'input' || activePanel === 'list' ? (
              <div className="panel-dock">
                {activePanel === 'input' ? (
                  <InputSelector
                    value={state.input}
                    disabled={!receiverAvailable}
                    pendingCommand={pendingFor('input')}
                    onChange={setInput}
                  />
                ) : null}

                {activePanel === 'list' ? (
                  <NetList
                    state={state}
                    pendingCommand={pendingFor('list') ?? pendingFor('input')}
                    command={api.command}
                    rawCommand={api.rawCommand}
                    serviceUrl={serviceUrl}
                    navigationTarget={libraryNavigationTarget}
                    onNavigationHandled={() => setLibraryNavigationTarget(null)}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )}
          </div>
          {(activePanel === 'home' || activePanel === 'list') && !settingsOpen ? (
            <footer className="v2-mini-player" aria-label="Persistent player">
              <div className="v2-mini-art">
                <span aria-hidden="true">♪</span>
                {miniCoverArtSrc ? (
                  <img
                    key={miniCoverArtSrc}
                    src={miniCoverArtSrc}
                    alt={`${state.nowPlaying.title || 'Current track'} artwork`}
                    onError={(event) => { event.currentTarget.hidden = true; }}
                  />
                ) : null}
              </div>
              <div className="v2-mini-copy"><strong>{state.nowPlaying.title || 'Nothing playing'}</strong><span>{[state.nowPlaying.artist, state.nowPlaying.album].filter(Boolean).join(' • ') || 'Choose music from your library'}</span></div>
              <PlaybackControls playback={state.playback} disabled={!receiverAvailable} pendingCommand={pendingFor('playback')} onAction={runPlayback} />
              <VolumeControl
                compact
                sliderLabel="Mini player volume"
                volume={state.volume}
                disabled={!receiverAvailable}
                muted={state.muted}
                pending={pendingFor('volume') !== null}
                onStepDown={() => setVolume('down')}
                onStepUp={() => setVolume('up')}
                onCommit={setVolume}
                onMute={runMute}
              />
            </footer>
          ) : null}
        </div>
      </section>
    </main>
  );
}
