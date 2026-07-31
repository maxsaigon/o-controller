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
    rerender({ serviceUrl: 'http://new-service:8787' });
    await waitFor(() => expect(result.current.state.nowPlaying.title).toBe('New endpoint'));

    let succeeded: boolean | undefined;
    await act(async () => {
      oldPostResponse.resolve(jsonResponse({ success: true }));
      succeeded = await oldCommandPromise;
    });

    expect(succeeded).toBe(false);
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
});
