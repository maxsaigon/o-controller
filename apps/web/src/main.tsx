import React from 'react';
import ReactDOM from 'react-dom/client';
import { Activity, Pause, Play, Power, RefreshCw, Square, Volume2, VolumeX } from 'lucide-react';
import type { InputId, OControlEvent, OControlState, PlaybackCommand, PresetDefinition } from '@o-control/shared';
import { useDebugApi } from './useDebugApi';
import './styles.css';

const INPUTS: Array<{ id: InputId; label: string }> = [
  { id: 'cd', label: 'CD' },
  { id: 'net', label: 'NET' },
  { id: 'usb', label: 'USB' },
  { id: 'bluetooth', label: 'Bluetooth' },
  { id: 'line', label: 'Line' },
  { id: 'tuner', label: 'Tuner' },
];

function stateRows(state: OControlState) {
  return [
    ['Connected', state.connected ? 'yes' : 'no'],
    ['Power', state.power],
    ['Input', state.input],
    ['Volume', String(state.volume)],
    ['Muted', state.muted ? 'yes' : 'no'],
    ['Playback', state.playback],
    ['Title', state.nowPlaying.title || '--'],
    ['Artist', state.nowPlaying.artist || '--'],
    ['Album', state.nowPlaying.album || '--'],
    ['Time', [state.nowPlaying.currentTime, state.nowPlaying.totalTime].filter(Boolean).join(' / ') || '--'],
  ];
}

function presetLabel(preset: PresetDefinition) {
  return preset.id === 'stop' ? 'Standby' : preset.name;
}

function eventLine(event: OControlEvent, index: number) {
  return {
    id: `${index}-${event.state.connected}-${event.state.volume}-${event.state.input}`,
    text: `${new Date().toLocaleTimeString()} state.changed power=${event.state.power} input=${event.state.input} volume=${event.state.volume} connected=${event.state.connected}`,
  };
}

function DebugApp() {
  const api = useDebugApi('http://localhost:8787', eventLine);
  const disabled = !api.serviceReachable;
  const receiverDisabled = disabled || !api.state.connected;
  const playPause: PlaybackCommand = api.state.playback === 'playing' ? 'pause' : 'play';

  return (
    <main className="debug-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">O-Control Debug</div>
          <h1>CR-N775 Service Console</h1>
        </div>
        <div className={`status ${api.serviceReachable ? 'online' : 'offline'}`}>
          <span />
          {api.connectionLabel}
        </div>
      </header>

      <section className="toolbar" aria-label="Service controls">
        <label>
          <span>Service URL</span>
          <input value={api.serviceUrl} onChange={(event) => api.setServiceUrl(event.currentTarget.value)} />
        </label>
        <button type="button" onClick={api.refresh}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </section>

      {api.error ? <p className="error-line">{api.error}</p> : null}

      <div className="debug-grid">
        <section className="panel controls-panel">
          <div className="panel-heading">
            <h2>Controls</h2>
            <span>{api.pendingCommand ?? 'idle'}</span>
          </div>

          <div className="control-row">
            <button type="button" disabled={disabled} onClick={() => api.command('/commands/power', { action: 'toggle' }, 'power')}>
              <Power size={17} />
              Power
            </button>
            <button type="button" disabled={receiverDisabled} onClick={() => api.command('/commands/mute', { action: 'toggle' }, 'mute')}>
              {api.state.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              Mute
            </button>
            <button type="button" disabled={receiverDisabled} onClick={() => api.command('/commands/playback', { action: playPause }, `playback:${playPause}`)}>
              {playPause === 'pause' ? <Pause size={17} /> : <Play size={17} />}
              {playPause === 'pause' ? 'Pause' : 'Play'}
            </button>
            <button type="button" disabled={receiverDisabled} onClick={() => api.command('/commands/playback', { action: 'stop' }, 'playback:stop')}>
              <Square size={15} />
              Stop
            </button>
          </div>

          <div className="volume-tools">
            <button type="button" disabled={receiverDisabled} onClick={() => api.command('/commands/volume', { value: 'down' }, 'volume:down')}>
              -1
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={api.state.volume}
              disabled={receiverDisabled}
              onChange={(event) => api.command('/commands/volume', { value: Number(event.currentTarget.value) }, 'volume:set')}
            />
            <button type="button" disabled={receiverDisabled} onClick={() => api.command('/commands/volume', { value: 'up' }, 'volume:up')}>
              +1
            </button>
          </div>

          <div className="selector-grid">
            {INPUTS.map((input) => (
              <button
                key={input.id}
                type="button"
                className={api.state.input === input.id ? 'selected' : ''}
                disabled={receiverDisabled}
                onClick={() => api.command('/commands/input', { input: input.id }, `input:${input.id}`)}
              >
                {input.label}
              </button>
            ))}
          </div>

          <div className="preset-grid">
            {api.presets.map((preset) => (
              <button key={preset.id} type="button" disabled={receiverDisabled} onClick={() => api.command(`/presets/${preset.id}/run`, {}, `preset:${preset.id}`)}>
                {presetLabel(preset)}
              </button>
            ))}
          </div>
        </section>

        <section className="panel state-panel">
          <div className="panel-heading">
            <h2>State</h2>
            <Activity size={16} />
          </div>
          <dl>
            {stateRows(api.state).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="panel event-panel">
          <div className="panel-heading">
            <h2>Raw Events</h2>
            <span>{api.events.length}/80</span>
          </div>
          <ol>
            {api.events.length === 0 ? <li>No events received</li> : null}
            {api.events.map((event) => (
              <li key={event.id}>{event.text}</li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DebugApp />
  </React.StrictMode>,
);
