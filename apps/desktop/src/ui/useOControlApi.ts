import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_STATE } from '@o-control/shared';
import type { OControlEvent, OControlState, PresetDefinition } from '@o-control/shared';

const EMPTY_STATE: OControlState = DEFAULT_STATE;

type ErrorState = {
  message: string;
  order: number;
};

type ActiveCommand = {
  generation: number;
  label: string;
};

function commandDomain(path: string) {
  if (path.startsWith('/presets/')) return 'preset';
  const domain = path.match(/^\/commands\/([^/]+)/)?.[1] ?? path;
  return domain === 'mute' ? 'volume' : domain;
}

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
  const [pendingCommands, setPendingCommands] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [serviceError, setServiceError] = useState<ErrorState | null>(null);
  const [commandErrors, setCommandErrors] = useState<ReadonlyMap<string, ErrorState>>(
    () => new Map(),
  );
  const mounted = useRef(false);
  const activeServiceUrl = useRef<string | null>(null);
  const lifecycleGeneration = useRef(0);
  const commandGenerations = useRef(new Map<string, number>());
  const activeCommands = useRef(new Map<string, ActiveCommand[]>());
  const errorOrder = useRef(0);
  const delayedRefreshTimers = useRef(new Map<string, number>());

  const clearDelayedRefresh = useCallback((domain?: string) => {
    if (domain !== undefined) {
      const timer = delayedRefreshTimers.current.get(domain);
      if (timer !== undefined) window.clearTimeout(timer);
      delayedRefreshTimers.current.delete(domain);
      return;
    }

    for (const timer of delayedRefreshTimers.current.values()) window.clearTimeout(timer);
    delayedRefreshTimers.current.clear();
  }, []);

  const setServiceErrorMessage = useCallback((message: string) => {
    errorOrder.current += 1;
    setServiceError({ message, order: errorOrder.current });
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
        setServiceError(null);
      } catch (err) {
        if (!isCurrent()) return;
        setServiceReachable(false);
        setServiceErrorMessage(err instanceof Error ? err.message : 'Service unavailable');
      }
    },
    [setServiceErrorMessage],
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
    setServiceError(null);
    setCommandErrors(new Map());
    setPendingCommands(new Map());
    activeCommands.current.clear();
    commandGenerations.current.clear();
    void refreshState(serviceUrl, () => (
      mounted.current
      && lifecycleGeneration.current === lifecycle
      && activeServiceUrl.current === serviceUrl
    ));

    return () => {
      if (lifecycleGeneration.current === lifecycle) {
        mounted.current = false;
        activeServiceUrl.current = null;
        activeCommands.current.clear();
        commandGenerations.current.clear();
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
        setServiceError(null);
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
          setServiceErrorMessage('Received malformed event from service');
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
  }, [serviceUrl, setServiceErrorMessage]);

  const command = useCallback(
    async (path: string, body: unknown, label: string): Promise<boolean> => {
      const lifecycle = lifecycleGeneration.current;
      const endpoint = serviceUrl;
      const domain = commandDomain(path);
      const active = activeCommands.current.get(domain) ?? [];
      if (active.some((candidate) => candidate.label === label)) return false;

      const generation = (commandGenerations.current.get(domain) ?? 0) + 1;
      commandGenerations.current.set(domain, generation);
      activeCommands.current.set(domain, [...active, { generation, label }]);
      clearDelayedRefresh(domain);

      const isCurrent = () => (
        mounted.current
        && lifecycleGeneration.current === lifecycle
        && activeServiceUrl.current === endpoint
        && commandGenerations.current.get(domain) === generation
      );

      setPendingCommands((current) => {
        const next = new Map(current);
        next.delete(domain);
        next.set(domain, label);
        return next;
      });
      setCommandErrors((current) => {
        if (!current.has(domain)) return current;
        const next = new Map(current);
        next.delete(domain);
        return next;
      });
      setServiceError(null);
      try {
        await readJson(`${endpoint}${path}`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        if (!isCurrent()) return false;
        await refreshState(endpoint, isCurrent);
        if (!isCurrent()) return false;

        // Fallback refresh for delayed receiver response
        const timer = window.setTimeout(() => {
          delayedRefreshTimers.current.delete(domain);
          if (isCurrent()) {
            void refreshState(endpoint, isCurrent);
          }
        }, 1500);
        delayedRefreshTimers.current.set(domain, timer);
        return true;
      } catch (err) {
        if (!isCurrent()) return false;
        errorOrder.current += 1;
        const nextError = {
          message: err instanceof Error ? err.message : `Command failed: ${label}`,
          order: errorOrder.current,
        };
        setCommandErrors((current) => new Map(current).set(domain, nextError));
        return false;
      } finally {
        const endpointIsCurrent = (
          mounted.current
          && lifecycleGeneration.current === lifecycle
          && activeServiceUrl.current === endpoint
        );
        if (endpointIsCurrent) {
          const remaining = (activeCommands.current.get(domain) ?? [])
            .filter((candidate) => candidate.generation !== generation);
          if (remaining.length > 0) activeCommands.current.set(domain, remaining);
          else activeCommands.current.delete(domain);

          setPendingCommands((current) => {
            const next = new Map(current);
            const latestRemaining = remaining[remaining.length - 1];
            if (latestRemaining) next.set(domain, latestRemaining.label);
            else next.delete(domain);
            return next;
          });
        }
      }
    },
    [clearDelayedRefresh, refreshState, serviceUrl],
  );

  const pendingCommand = useMemo(
    () => pendingCommands.values().next().value ?? null,
    [pendingCommands],
  );

  const pendingCommandFor = useCallback(
    (domain: string) => pendingCommands.get(domain) ?? null,
    [pendingCommands],
  );

  const error = useMemo(() => {
    let latest = serviceError;
    for (const commandError of commandErrors.values()) {
      if (latest === null || commandError.order > latest.order) latest = commandError;
    }
    return latest?.message ?? null;
  }, [commandErrors, serviceError]);

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
    pendingCommandFor,
    error,
    connectionLabel,
    refresh,
    command,
  };
}
