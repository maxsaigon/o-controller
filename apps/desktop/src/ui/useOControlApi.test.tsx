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
    expect(fetchMock).toHaveBeenCalledTimes(5);

    unmount();
    await act(async () => vi.runAllTimersAsync());

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].close).toHaveBeenCalledOnce();
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
