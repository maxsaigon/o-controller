import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_STATE } from '@o-control/shared';
import type { OControlEvent, OControlState, PresetDefinition } from '@o-control/shared';

const EMPTY_STATE: OControlState = DEFAULT_STATE;

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
  const mounted = useRef(false);
  const activeServiceUrl = useRef<string | null>(null);
  const lifecycleGeneration = useRef(0);
  const commandGeneration = useRef(0);
  const delayedRefreshTimer = useRef<number | undefined>(undefined);

  const clearDelayedRefresh = useCallback(() => {
    if (delayedRefreshTimer.current !== undefined) {
      window.clearTimeout(delayedRefreshTimer.current);
      delayedRefreshTimer.current = undefined;
    }
  }, []);

  const refreshState = useCallback(
    async (endpoint: string, isCurrent: () => boolean) => {
      try {
        const [nextState, nextPresets] = await Promise.all([
          readJson<OControlState>(`${endpoint}/state`),
          readJson<PresetDefinition[]>(`${endpoint}/presets`).catch(() => []),
        ]);
        if (!isCurrent()) return;
        setState(nextState);
        setPresets(nextPresets);
        setServiceReachable(true);
        setError(null);
      } catch (err) {
        if (!isCurrent()) return;
        setServiceReachable(false);
        setError(err instanceof Error ? err.message : 'Service unavailable');
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    const lifecycle = lifecycleGeneration.current;
    const endpoint = serviceUrl;
    await refreshState(endpoint, () => (
      mounted.current
      && lifecycleGeneration.current === lifecycle
      && activeServiceUrl.current === endpoint
    ));
  }, [refreshState, serviceUrl]);

  useEffect(() => {
    const lifecycle = lifecycleGeneration.current + 1;
    lifecycleGeneration.current = lifecycle;
    mounted.current = true;
    activeServiceUrl.current = serviceUrl;
    setState(EMPTY_STATE);
    setPresets([]);
    setServiceReachable(false);
    setError(null);
    setPendingCommand(null);
    void refreshState(serviceUrl, () => (
      mounted.current
      && lifecycleGeneration.current === lifecycle
      && activeServiceUrl.current === serviceUrl
    ));

    return () => {
      if (lifecycleGeneration.current === lifecycle) {
        mounted.current = false;
        activeServiceUrl.current = null;
        commandGeneration.current += 1;
        clearDelayedRefresh();
      }
    };
  }, [clearDelayedRefresh, refreshState, serviceUrl]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let closed = false;

    function connect() {
      if (closed) return;
      try {
        socket = new WebSocket(eventUrl(serviceUrl));
      } catch {
        if (closed) return;
        setServiceReachable(false);
        return;
      }

      socket.addEventListener('open', () => {
        if (closed) return;
        setError(null);
      });

      socket.addEventListener('message', (message) => {
        if (closed) return;
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
        if (closed) return;
        setServiceReachable(false);
      });
    }

    connect();

    return () => {
      closed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [serviceUrl]);

  const command = useCallback(
    async (path: string, body: unknown, label: string): Promise<boolean> => {
      const lifecycle = lifecycleGeneration.current;
      const endpoint = serviceUrl;
      const generation = commandGeneration.current + 1;
      commandGeneration.current = generation;
      clearDelayedRefresh();

      const isCurrent = () => (
        mounted.current
        && lifecycleGeneration.current === lifecycle
        && activeServiceUrl.current === endpoint
        && commandGeneration.current === generation
      );

      setPendingCommand(label);
      setError(null);
      try {
        await readJson(`${endpoint}${path}`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        if (!isCurrent()) return false;
        await refreshState(endpoint, isCurrent);
        if (!isCurrent()) return false;

        // Fallback refresh for delayed receiver response
        delayedRefreshTimer.current = window.setTimeout(() => {
          delayedRefreshTimer.current = undefined;
          if (isCurrent()) {
            void refreshState(endpoint, isCurrent);
          }
        }, 1500);
        return true;
      } catch (err) {
        if (!isCurrent()) return false;
        setError(err instanceof Error ? err.message : `Command failed: ${label}`);
        return false;
      } finally {
        if (isCurrent()) {
          setPendingCommand(null);
        }
      }
    },
    [clearDelayedRefresh, refreshState, serviceUrl],
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
