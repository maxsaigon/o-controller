import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OControlEvent, OControlState, PresetDefinition } from '@o-control/shared';

const EMPTY_STATE: OControlState = {
  connected: false,
  power: 'unknown',
  input: 'unknown',
  volume: 0,
  muted: false,
  playback: 'unknown',
  nowPlaying: {
    title: '',
    artist: '',
    album: '',
    currentTime: '',
    totalTime: '',
    trackNumber: '',
  },
};

function eventUrl(serviceUrl: string) {
  const url = new URL(serviceUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/events';
  url.search = '';
  return url.toString();
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function useOControlApi(serviceUrl: string) {
  const [state, setState] = useState<OControlState>(EMPTY_STATE);
  const [presets, setPresets] = useState<PresetDefinition[]>([]);
  const [serviceReachable, setServiceReachable] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [nextState, nextPresets] = await Promise.all([
        readJson<OControlState>(`${serviceUrl}/state`),
        readJson<PresetDefinition[]>(`${serviceUrl}/presets`).catch(() => []),
      ]);
      if (!mounted.current) return;
      setState(nextState);
      setPresets(nextPresets);
      setServiceReachable(true);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setServiceReachable(false);
      setError(err instanceof Error ? err.message : 'Service unavailable');
    }
  }, [serviceUrl]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let closed = false;

    function connect() {
      try {
        socket = new WebSocket(eventUrl(serviceUrl));
      } catch {
        setServiceReachable(false);
        return;
      }

      socket.addEventListener('open', () => {
        setServiceReachable(true);
        setError(null);
      });

      socket.addEventListener('message', (message) => {
        try {
          const event = JSON.parse(message.data as string) as OControlEvent;
          if (event.type === 'state.changed') {
            setState(event.state);
            setServiceReachable(true);
          }
        } catch {
          setError('Received malformed event from service');
        }
      });

      socket.addEventListener('close', () => {
        if (closed) return;
        setServiceReachable(false);
        retryTimer = window.setTimeout(connect, 1800);
      });

      socket.addEventListener('error', () => {
        setServiceReachable(false);
      });
    }

    connect();

    return () => {
      closed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [serviceUrl]);

  const command = useCallback(
    async (path: string, body: unknown, label: string) => {
      setPendingCommand(label);
      setError(null);
      try {
        await readJson(`${serviceUrl}${path}`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        await refresh();
        // Fallback refresh for delayed receiver response
        setTimeout(() => refresh(), 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Command failed: ${label}`);
      } finally {
        setPendingCommand(null);
      }
    },
    [refresh, serviceUrl],
  );

  const connectionLabel = useMemo(() => {
    if (!serviceReachable) return 'Service offline';
    if (!state.connected) return 'Receiver offline';
    if (pendingCommand) return 'Updating';
    return 'Connected';
  }, [pendingCommand, serviceReachable, state.connected]);

  return {
    state,
    presets,
    serviceReachable,
    pendingCommand,
    error,
    connectionLabel,
    refresh,
    command,
  };
}
