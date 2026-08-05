import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiverState } from '../test/fixtures';
import { useOControlApi } from './useOControlApi';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  close = vi.fn();

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type: string, data?: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data } as MessageEvent);
    }
  }
}

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 503,
    statusText: ok ? 'OK' : 'Unavailable',
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useOControlApi', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(receiverState()))
      .mockResolvedValueOnce(jsonResponse([]));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('preserves the last confirmed state when refresh fails', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.state.nowPlaying.title).toBe('Blue in Green'));

    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(jsonResponse([]));
    await act(async () => result.current.refresh());

    expect(result.current.state.nowPlaying.title).toBe('Blue in Green');
    expect(result.current.serviceReachable).toBe(false);
    unmount();
  });

  it('gates a replacement endpoint until its state is confirmed', async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(receiverState({ volume: 22 })))
      .mockResolvedValueOnce(jsonResponse([
        { id: 'endpoint-a', name: 'Endpoint A', description: '', steps: [] },
      ]));

    const { result, rerender, unmount } = renderHook(
      ({ serviceUrl }) => useOControlApi(serviceUrl),
      { initialProps: { serviceUrl: 'http://endpoint-a:8787' } },
    );
    await waitFor(() => expect(result.current.presets.map(({ id }) => id)).toEqual(['endpoint-a']));
    expect(result.current.state.connected).toBe(true);
    expect(result.current.serviceReachable).toBe(true);

    act(() => MockWebSocket.instances[0].emit('message', 'malformed'));
    expect(result.current.error).toBe('Received malformed event from service');

    const endpointBState = deferred<Response>();
    fetchMock
      .mockImplementationOnce(() => endpointBState.promise)
      .mockResolvedValueOnce(jsonResponse([
        { id: 'endpoint-b', name: 'Endpoint B', description: '', steps: [] },
      ]));
    rerender({ serviceUrl: 'http://endpoint-b:8787' });

    expect(result.current.state.connected).toBe(false);
    expect(result.current.presets).toEqual([]);
    expect(result.current.serviceReachable).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.pendingCommand).toBeNull();

    act(() => MockWebSocket.instances[1].emit('open'));
    expect(result.current.state.connected).toBe(false);
    expect(result.current.serviceReachable).toBe(false);

    endpointBState.resolve(jsonResponse(receiverState({ volume: 44 })));
    await waitFor(() => expect(result.current.state.volume).toBe(44));
    expect(result.current.state.connected).toBe(true);
    expect(result.current.presets.map(({ id }) => id)).toEqual(['endpoint-b']);
    expect(result.current.serviceReachable).toBe(true);
    unmount();
  });

  it('applies WebSocket state and reconnects 1800ms after an unexpected close', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    act(() => {
      MockWebSocket.instances[0].emit(
        'message',
        JSON.stringify({ type: 'state.changed', state: receiverState({ volume: 31 }) }),
      );
    });
    expect(result.current.state.volume).toBe(31);

    vi.useFakeTimers();
    act(() => MockWebSocket.instances[0].emit('close'));
    await act(async () => vi.advanceTimersByTimeAsync(1799));
    expect(MockWebSocket.instances).toHaveLength(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(MockWebSocket.instances).toHaveLength(2);

    unmount();
    await act(async () => vi.runAllTimersAsync());
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[0].close).not.toHaveBeenCalled();
    expect(MockWebSocket.instances[1].close).toHaveBeenCalledOnce();
  });

  it('ignores old socket events after switching service URLs', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ serviceUrl }) => useOControlApi(serviceUrl),
      { initialProps: { serviceUrl: 'http://old-service:8787' } },
    );
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));
    const oldSocket = MockWebSocket.instances[0];

    fetchMock
      .mockResolvedValueOnce(jsonResponse(receiverState({ volume: 44 })))
      .mockResolvedValueOnce(jsonResponse([]));
    rerender({ serviceUrl: 'http://new-service:8787' });
    await waitFor(() => expect(result.current.state.volume).toBe(44));

    act(() => oldSocket.emit('error'));
    expect(result.current.serviceReachable).toBe(true);

    act(() => {
      oldSocket.emit(
        'message',
        JSON.stringify({ type: 'state.changed', state: receiverState({ volume: 99 }) }),
      );
    });
    expect(result.current.state.volume).toBe(44);

    fetchMock
      .mockRejectedValueOnce(new Error('new endpoint offline'))
      .mockResolvedValueOnce(jsonResponse([]));
    await act(async () => result.current.refresh());
    expect(result.current.serviceReachable).toBe(false);
    expect(result.current.error).toBe('new endpoint offline');

    act(() => oldSocket.emit('open'));
    expect(result.current.serviceReachable).toBe(false);
    expect(result.current.error).toBe('new endpoint offline');
    unmount();
  });

  it('does not let an old refresh overwrite a new service URL', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ serviceUrl }) => useOControlApi(serviceUrl),
      { initialProps: { serviceUrl: 'http://old-service:8787' } },
    );
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    const oldStateResponse = deferred<Response>();
    fetchMock
      .mockImplementationOnce(() => oldStateResponse.promise)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse(receiverState({
          volume: 44,
          nowPlaying: { ...receiverState().nowPlaying, title: 'New endpoint' },
        })),
      )
      .mockResolvedValueOnce(jsonResponse([]));

    let oldRefreshPromise!: Promise<void>;
    act(() => {
      oldRefreshPromise = result.current.refresh();
    });
    rerender({ serviceUrl: 'http://new-service:8787' });
    await waitFor(() => expect(result.current.state.nowPlaying.title).toBe('New endpoint'));

    await act(async () => {
      oldStateResponse.resolve(
        jsonResponse(receiverState({
          volume: 91,
          nowPlaying: { ...receiverState().nowPlaying, title: 'Old endpoint' },
        })),
      );
      await oldRefreshPromise;
    });

    expect(result.current.state.nowPlaying.title).toBe('New endpoint');
    expect(result.current.state.volume).toBe(44);
    unmount();
  });

  it('invalidates an in-flight command when the hook unmounts', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    const postResponse = deferred<Response>();
    fetchMock.mockImplementationOnce(() => postResponse.promise);
    vi.useFakeTimers();
    let commandPromise!: Promise<boolean>;
    act(() => {
      commandPromise = result.current.command('/commands/volume', { value: 22 }, 'volume:set');
    });
    const fetchCountBeforeUnmount = fetchMock.mock.calls.length;

    unmount();
    let succeeded: boolean | undefined;
    await act(async () => {
      postResponse.resolve(jsonResponse({ success: true }));
      succeeded = await commandPromise;
    });

    expect(succeeded).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(fetchCountBeforeUnmount);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('invalidates an old command when the service URL changes', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ serviceUrl }) => useOControlApi(serviceUrl),
      { initialProps: { serviceUrl: 'http://old-service:8787' } },
    );
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    const oldPostResponse = deferred<Response>();
    fetchMock
      .mockImplementationOnce(() => oldPostResponse.promise)
      .mockResolvedValueOnce(
        jsonResponse(receiverState({
          volume: 44,
          nowPlaying: { ...receiverState().nowPlaying, title: 'New endpoint' },
        })),
      )
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse(receiverState({
          volume: 91,
          nowPlaying: { ...receiverState().nowPlaying, title: 'Old endpoint' },
        })),
      )
      .mockResolvedValueOnce(jsonResponse([]));

    let oldCommandPromise!: Promise<boolean>;
    act(() => {
      oldCommandPromise = result.current.command(
        '/commands/input',
        { input: 'net' },
        'input:net',
      );
    });
    expect(result.current.pendingCommand).toBe('input:net');

    rerender({ serviceUrl: 'http://new-service:8787' });
    await waitFor(() => expect(result.current.state.nowPlaying.title).toBe('New endpoint'));
    expect(result.current.pendingCommand).toBeNull();

    let succeeded: boolean | undefined;
    await act(async () => {
      oldPostResponse.resolve(jsonResponse({ success: true }));
      succeeded = await oldCommandPromise;
    });

    expect(succeeded).toBe(false);
    expect(result.current.pendingCommand).toBeNull();
    expect(result.current.state.nowPlaying.title).toBe('New endpoint');
    expect(result.current.state.volume).toBe(44);
    unmount();
  });

  it('closes the socket and clears delayed command refresh on unmount', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse(receiverState()))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.useFakeTimers();
    await act(async () => {
      await result.current.command('/commands/volume', { value: 22 }, 'volume:set');
    });
    const commandPostCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(commandPostCalls).toHaveLength(1);
    expect(String(commandPostCalls[0][0])).toBe('http://localhost:8787/commands/volume');
    const fetchCountBeforeUnmount = fetchMock.mock.calls.length;

    unmount();
    await act(async () => vi.runAllTimersAsync());

    expect(fetchMock).toHaveBeenCalledTimes(fetchCountBeforeUnmount);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].close).toHaveBeenCalledOnce();
  });

  it('does not let a superseded command clear the newer pending command', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    const olderPostResponse = deferred<Response>();
    const newerPostResponse = deferred<Response>();
    fetchMock
      .mockImplementationOnce(() => olderPostResponse.promise)
      .mockImplementationOnce(() => newerPostResponse.promise)
      .mockResolvedValueOnce(jsonResponse(receiverState()))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.useFakeTimers();

    let olderCommandPromise!: Promise<boolean>;
    act(() => {
      olderCommandPromise = result.current.command(
        '/commands/input',
        { input: 'net' },
        'input:net',
      );
    });
    let newerCommandPromise!: Promise<boolean>;
    act(() => {
      newerCommandPromise = result.current.command(
        '/commands/input',
        { input: 'usb' },
        'input:usb',
      );
    });
    expect(result.current.pendingCommand).toBe('input:usb');

    let olderSucceeded: boolean | undefined;
    await act(async () => {
      olderPostResponse.resolve(jsonResponse({ success: true }));
      olderSucceeded = await olderCommandPromise;
    });
    expect(olderSucceeded).toBe(false);
    expect(result.current.pendingCommand).toBe('input:usb');

    await act(async () => {
      newerPostResponse.resolve(jsonResponse('Newer command failed', false));
      await newerCommandPromise;
    });
    expect(result.current.pendingCommand).toBeNull();
    expect(result.current.error).toBe('Newer command failed');
    unmount();
  });

  it('cancels an old fallback refresh when a newer command fails', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse(receiverState()))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse('Newer command failed', false))
      .mockResolvedValueOnce(jsonResponse(receiverState({ volume: 99 })))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.useFakeTimers();

    await act(async () => {
      await result.current.command('/commands/volume', { value: 22 }, 'volume:set');
    });
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => {
      await result.current.command('/commands/volume', { value: 23 }, 'volume:set');
    });
    expect(result.current.error).toBe('Newer command failed');
    const fetchCountBeforeAdvance = fetchMock.mock.calls.length;

    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(fetchMock).toHaveBeenCalledTimes(fetchCountBeforeAdvance);
    expect(result.current.error).toBe('Newer command failed');
    unmount();
  });

  it('clears pending after failure and allows a successful retry', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    fetchMock.mockResolvedValueOnce(jsonResponse('Receiver rejected', false));
    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.command('/commands/volume', { value: 22 }, 'volume:set');
    });
    expect(succeeded).toBe(false);
    expect(result.current.pendingCommand).toBeNull();
    expect(result.current.error).toBe('Receiver rejected');

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse(receiverState()))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.useFakeTimers();
    await act(async () => {
      succeeded = await result.current.command('/commands/volume', { value: 22 }, 'volume:set');
    });
    expect(succeeded).toBe(true);
    expect(result.current.pendingCommand).toBeNull();
    expect(result.current.error).toBeNull();
    unmount();
  });

  it('keeps unrelated command domains pending and refreshes both valid completions', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    const powerPostResponse = deferred<Response>();
    const playbackPostResponse = deferred<Response>();
    let refreshCount = 0;
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/commands/power')) {
        return powerPostResponse.promise;
      }
      if (init?.method === 'POST' && url.endsWith('/commands/playback')) {
        return playbackPostResponse.promise;
      }
      if (url.endsWith('/state')) {
        refreshCount += 1;
        return Promise.resolve(jsonResponse(receiverState({ volume: 20 + refreshCount })));
      }
      if (url.endsWith('/presets')) {
        return Promise.resolve(jsonResponse([]));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    let powerPromise!: Promise<boolean>;
    act(() => {
      powerPromise = result.current.command('/commands/power', { action: 'toggle' }, 'power');
    });
    let playbackPromise!: Promise<boolean>;
    act(() => {
      playbackPromise = result.current.command(
        '/commands/playback',
        { action: 'pause' },
        'playback:pause',
      );
    });

    expect(result.current.pendingCommandFor('power')).toBe('power');
    expect(result.current.pendingCommandFor('playback')).toBe('playback:pause');

    let playbackSucceeded: boolean | undefined;
    await act(async () => {
      playbackPostResponse.resolve(jsonResponse({ success: true }));
      playbackSucceeded = await playbackPromise;
    });
    expect(playbackSucceeded).toBe(true);
    expect(refreshCount).toBe(1);
    expect(result.current.pendingCommandFor('power')).toBe('power');
    expect(result.current.pendingCommandFor('playback')).toBeNull();

    let powerSucceeded: boolean | undefined;
    await act(async () => {
      powerPostResponse.resolve(jsonResponse({ success: true }));
      powerSucceeded = await powerPromise;
    });
    expect(powerSucceeded).toBe(true);
    expect(refreshCount).toBe(2);
    expect(result.current.pendingCommandFor('power')).toBeNull();
    expect(fetchMock.mock.calls
      .filter(([input]) => String(input).endsWith('/state'))
      .every(([input]) => String(input).startsWith('http://localhost:8787/'))).toBe(true);
    unmount();
  });

  it('rejects a duplicate action while the same command label is pending', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    const firstPostResponse = deferred<Response>();
    let postCount = 0;
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === 'POST') {
        postCount += 1;
        return postCount === 1
          ? firstPostResponse.promise
          : Promise.resolve(jsonResponse({ success: true }));
      }
      if (url.endsWith('/state')) return Promise.resolve(jsonResponse(receiverState()));
      if (url.endsWith('/presets')) return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });

    let firstPromise!: Promise<boolean>;
    act(() => {
      firstPromise = result.current.command('/commands/power', { action: 'toggle' }, 'power');
    });

    let duplicateSucceeded: boolean | undefined;
    await act(async () => {
      duplicateSucceeded = await result.current.command(
        '/commands/power',
        { action: 'toggle' },
        'power',
      );
    });
    expect(duplicateSucceeded).toBe(false);
    expect(postCount).toBe(1);

    let firstSucceeded: boolean | undefined;
    await act(async () => {
      firstPostResponse.resolve(jsonResponse({ success: true }));
      firstSucceeded = await firstPromise;
    });
    expect(firstSucceeded).toBe(true);
    unmount();
  });

  it('gates an interleaved duplicate until its older same-domain action settles', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    const firstInputResponse = deferred<Response>();
    const secondInputResponse = deferred<Response>();
    let postCount = 0;
    let refreshCount = 0;
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === 'POST') {
        postCount += 1;
        if (postCount === 1) return firstInputResponse.promise;
        if (postCount === 2) return secondInputResponse.promise;
        return Promise.resolve(jsonResponse({ success: true }));
      }
      if (url.endsWith('/state')) {
        refreshCount += 1;
        return Promise.resolve(jsonResponse(receiverState()));
      }
      if (url.endsWith('/presets')) return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });

    let firstInputPromise!: Promise<boolean>;
    let secondInputPromise!: Promise<boolean>;
    act(() => {
      firstInputPromise = result.current.command(
        '/commands/input',
        { input: 'net' },
        'input:net',
      );
      secondInputPromise = result.current.command(
        '/commands/input',
        { input: 'usb' },
        'input:usb',
      );
    });

    let interleavedDuplicateSucceeded: boolean | undefined;
    await act(async () => {
      interleavedDuplicateSucceeded = await result.current.command(
        '/commands/input',
        { input: 'net' },
        'input:net',
      );
    });
    expect(interleavedDuplicateSucceeded).toBe(false);
    expect(postCount).toBe(2);
    expect(result.current.pendingCommandFor('input')).toBe('input:usb');

    await act(async () => {
      secondInputResponse.resolve(jsonResponse({ success: true }));
      await secondInputPromise;
    });
    expect(refreshCount).toBe(1);
    expect(result.current.pendingCommandFor('input')).toBe('input:net');

    let remainingDuplicateSucceeded: boolean | undefined;
    await act(async () => {
      remainingDuplicateSucceeded = await result.current.command(
        '/commands/input',
        { input: 'net' },
        'input:net',
      );
    });
    expect(remainingDuplicateSucceeded).toBe(false);
    expect(postCount).toBe(2);

    let firstInputSucceeded: boolean | undefined;
    await act(async () => {
      firstInputResponse.resolve(jsonResponse('Stale input failed', false));
      firstInputSucceeded = await firstInputPromise;
    });
    expect(firstInputSucceeded).toBe(false);
    expect(refreshCount).toBe(1);
    expect(result.current.pendingCommandFor('input')).toBeNull();
    expect(result.current.error).toBeNull();
    unmount();
  });

  it('does not clear one command domain error when an unrelated command refreshes', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    const powerPostResponse = deferred<Response>();
    const playbackPostResponse = deferred<Response>();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/commands/power')) {
        return powerPostResponse.promise;
      }
      if (init?.method === 'POST' && url.endsWith('/commands/playback')) {
        return playbackPostResponse.promise;
      }
      if (url.endsWith('/state')) return Promise.resolve(jsonResponse(receiverState()));
      if (url.endsWith('/presets')) return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });

    let powerPromise!: Promise<boolean>;
    let playbackPromise!: Promise<boolean>;
    act(() => {
      powerPromise = result.current.command('/commands/power', { action: 'toggle' }, 'power');
      playbackPromise = result.current.command(
        '/commands/playback',
        { action: 'pause' },
        'playback:pause',
      );
    });

    await act(async () => {
      powerPostResponse.resolve(jsonResponse('Power command failed', false));
      await powerPromise;
    });
    expect(result.current.error).toBe('Power command failed');

    await act(async () => {
      playbackPostResponse.resolve(jsonResponse({ success: true }));
      await playbackPromise;
    });
    expect(result.current.error).toBe('Power command failed');
    unmount();
  });

  it('keeps the newest cross-domain state refresh when responses resolve in reverse order', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    const olderStateResponse = deferred<Response>();
    const olderPresetsResponse = deferred<Response>();
    const newerStateResponse = deferred<Response>();
    const newerPresetsResponse = deferred<Response>();
    let stateRequestCount = 0;
    let presetRequestCount = 0;
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ success: true }));
      }
      if (url.endsWith('/state')) {
        stateRequestCount += 1;
        return stateRequestCount === 1 ? olderStateResponse.promise : newerStateResponse.promise;
      }
      if (url.endsWith('/presets')) {
        presetRequestCount += 1;
        return presetRequestCount === 1
          ? olderPresetsResponse.promise
          : newerPresetsResponse.promise;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    let olderCommandPromise!: Promise<boolean>;
    act(() => {
      olderCommandPromise = result.current.command(
        '/commands/power',
        { action: 'toggle' },
        'power',
      );
    });
    await waitFor(() => expect(stateRequestCount).toBe(1));

    let newerCommandPromise!: Promise<boolean>;
    act(() => {
      newerCommandPromise = result.current.command(
        '/commands/playback',
        { action: 'pause' },
        'playback:pause',
      );
    });
    await waitFor(() => expect(stateRequestCount).toBe(2));

    await act(async () => {
      newerStateResponse.resolve(jsonResponse(receiverState({ volume: 44 })));
      newerPresetsResponse.resolve(jsonResponse([
        { id: 'newer', name: 'Newer', description: '', steps: [] },
      ]));
      await newerCommandPromise;
    });
    expect(result.current.state.volume).toBe(44);
    expect(result.current.presets.map(({ id }) => id)).toEqual(['newer']);

    await act(async () => {
      olderStateResponse.resolve(jsonResponse(receiverState({ volume: 11 })));
      olderPresetsResponse.resolve(jsonResponse([
        { id: 'older', name: 'Older', description: '', steps: [] },
      ]));
      await olderCommandPromise;
    });
    expect(result.current.state.volume).toBe(44);
    expect(result.current.presets.map(({ id }) => id)).toEqual(['newer']);
    unmount();
  });

  it('clears existing command errors after a successful manual refresh', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    fetchMock.mockResolvedValueOnce(jsonResponse('Power command failed', false));
    await act(async () => {
      await result.current.command('/commands/power', { action: 'toggle' }, 'power');
    });
    expect(result.current.error).toBe('Power command failed');

    fetchMock
      .mockResolvedValueOnce(jsonResponse(receiverState({ volume: 33 })))
      .mockResolvedValueOnce(jsonResponse([]));
    await act(async () => result.current.refresh());

    expect(result.current.state.volume).toBe(33);
    expect(result.current.error).toBeNull();
    unmount();
  });

  it('preserves command errors raised after a manual refresh starts', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    fetchMock.mockResolvedValueOnce(jsonResponse('Old power error', false));
    await act(async () => {
      await result.current.command('/commands/power', { action: 'toggle' }, 'power');
    });
    expect(result.current.error).toBe('Old power error');

    const manualStateResponse = deferred<Response>();
    let manualStateRequested = false;
    let playbackPostCount = 0;
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/commands/playback')) {
        playbackPostCount += 1;
        return Promise.resolve(playbackPostCount === 1
          ? jsonResponse('New playback error', false)
          : jsonResponse({ success: true }));
      }
      if (url.endsWith('/state')) {
        if (!manualStateRequested) {
          manualStateRequested = true;
          return manualStateResponse.promise;
        }
        return Promise.resolve(jsonResponse(receiverState()));
      }
      if (url.endsWith('/presets')) return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });

    let manualRefreshPromise!: Promise<void>;
    act(() => {
      manualRefreshPromise = result.current.refresh();
    });
    await waitFor(() => expect(manualStateRequested).toBe(true));

    await act(async () => {
      await result.current.command(
        '/commands/playback',
        { action: 'pause' },
        'playback:pause',
      );
    });
    expect(result.current.error).toBe('New playback error');

    await act(async () => {
      manualStateResponse.resolve(jsonResponse(receiverState({ volume: 35 })));
      await manualRefreshPromise;
    });
    expect(result.current.error).toBe('New playback error');

    await act(async () => {
      await result.current.command(
        '/commands/playback',
        { action: 'pause' },
        'playback:pause',
      );
    });
    expect(result.current.error).toBeNull();
    unmount();
  });

  it('clears old errors when a successful manual response is superseded by an internal refresh', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    fetchMock.mockResolvedValueOnce(jsonResponse('Old power error', false));
    await act(async () => {
      await result.current.command('/commands/power', { action: 'toggle' }, 'power');
    });
    expect(result.current.error).toBe('Old power error');

    const manualStateResponse = deferred<Response>();
    let stateRequestCount = 0;
    let presetRequestCount = 0;
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === 'POST') return Promise.resolve(jsonResponse({ success: true }));
      if (url.endsWith('/state')) {
        stateRequestCount += 1;
        return stateRequestCount === 1
          ? manualStateResponse.promise
          : Promise.resolve(jsonResponse(receiverState({ volume: 44 })));
      }
      if (url.endsWith('/presets')) {
        presetRequestCount += 1;
        return Promise.resolve(jsonResponse([
          {
            id: presetRequestCount === 1 ? 'manual-old' : 'internal-new',
            name: 'Preset',
            description: '',
            steps: [],
          },
        ]));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    let manualRefreshPromise!: Promise<void>;
    act(() => {
      manualRefreshPromise = result.current.refresh();
    });
    await waitFor(() => expect(stateRequestCount).toBe(1));

    await act(async () => {
      await result.current.command(
        '/commands/playback',
        { action: 'pause' },
        'playback:pause',
      );
    });
    expect(result.current.state.volume).toBe(44);
    expect(result.current.presets.map(({ id }) => id)).toEqual(['internal-new']);
    expect(result.current.error).toBe('Old power error');

    await act(async () => {
      manualStateResponse.resolve(jsonResponse(receiverState({ volume: 11 })));
      await manualRefreshPromise;
    });
    expect(result.current.state.volume).toBe(44);
    expect(result.current.presets.map(({ id }) => id)).toEqual(['internal-new']);
    expect(result.current.error).toBeNull();
    unmount();
  });

  it('returns raw command failures without publishing a global player error', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    fetchMock.mockResolvedValueOnce(jsonResponse('OSD command rejected', false));

    let rawResult: Awaited<ReturnType<typeof result.current.rawCommand>> | undefined;
    await act(async () => {
      rawResult = await result.current.rawCommand(
        '/commands/list/action',
        { action: 'enter' },
      );
    });

    expect(rawResult).toEqual({ ok: false, error: 'OSD command rejected' });
    expect(result.current.error).toBeNull();
    expect(result.current.pendingCommand).toBeNull();
    unmount();
  });

  it('links an external abort signal to raw commands and removes its listener', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    const rawResponse = deferred<Response>();
    let requestSignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_input, init) => {
      requestSignal = init?.signal ?? undefined;
      return rawResponse.promise;
    });
    const external = new AbortController();
    const addListener = vi.spyOn(external.signal, 'addEventListener');
    const removeListener = vi.spyOn(external.signal, 'removeEventListener');
    let rawPromise!: ReturnType<typeof result.current.rawCommand>;
    act(() => {
      rawPromise = result.current.rawCommand('/commands/list/query', {}, external.signal);
    });

    external.abort();
    expect(requestSignal?.aborted).toBe(true);
    let rawResult: Awaited<typeof rawPromise> | undefined;
    await act(async () => {
      rawResponse.resolve(jsonResponse({ success: true }));
      rawResult = await rawPromise;
    });

    expect(rawResult).toEqual({ ok: false, error: 'Command cancelled' });
    expect(addListener).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(result.current.error).toBeNull();
    unmount();
  });

  it('aborts an in-flight raw command when the service URL changes', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ serviceUrl }) => useOControlApi(serviceUrl),
      { initialProps: { serviceUrl: 'http://old-service:8787' } },
    );
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    const rawResponse = deferred<Response>();
    let requestSignal: AbortSignal | undefined;
    fetchMock
      .mockImplementationOnce((_input, init) => {
        requestSignal = init?.signal ?? undefined;
        return rawResponse.promise;
      })
      .mockResolvedValueOnce(jsonResponse(receiverState({ volume: 45 })))
      .mockResolvedValueOnce(jsonResponse([]));
    let rawPromise!: ReturnType<typeof result.current.rawCommand>;
    act(() => {
      rawPromise = result.current.rawCommand('/commands/list/query', {});
    });

    rerender({ serviceUrl: 'http://new-service:8787' });
    expect(requestSignal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.state.volume).toBe(45));
    let rawResult: Awaited<typeof rawPromise> | undefined;
    await act(async () => {
      rawResponse.resolve(jsonResponse({ success: true }));
      rawResult = await rawPromise;
    });

    expect(rawResult).toEqual({ ok: false, error: 'Command cancelled' });
    expect(result.current.error).toBeNull();
    unmount();
  });

  it('aborts an in-flight raw command when the hook unmounts', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await waitFor(() => expect(result.current.serviceReachable).toBe(true));

    const rawResponse = deferred<Response>();
    let requestSignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_input, init) => {
      requestSignal = init?.signal ?? undefined;
      return rawResponse.promise;
    });
    let rawPromise!: ReturnType<typeof result.current.rawCommand>;
    act(() => {
      rawPromise = result.current.rawCommand('/commands/list/query', {});
    });

    unmount();
    expect(requestSignal?.aborted).toBe(true);
    let rawResult: Awaited<typeof rawPromise> | undefined;
    await act(async () => {
      rawResponse.resolve(jsonResponse({ success: true }));
      rawResult = await rawPromise;
    });

    expect(rawResult).toEqual({ ok: false, error: 'Command cancelled' });
  });
});
