import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiverState } from '../test/fixtures';
import { useOControlApi } from './useOControlApi';

class FakeWebSocket {
  constructor(_url: string) {}

  addEventListener() {}

  close() {}
}

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function errorResponse(message: string): Response {
  return {
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    json: async () => ({ error: message }),
    text: async () => message,
  } as Response;
}

async function flushInitialRefresh() {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('useOControlApi command result', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/commands/fail')) {
        return errorResponse('Receiver rejected');
      }
      if (url.endsWith('/state')) return jsonResponse(receiverState());
      if (url.endsWith('/presets')) return jsonResponse([]);
      return jsonResponse({ success: true });
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns false and exposes the error when a command fails', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await flushInitialRefresh();
    expect(result.current.serviceReachable).toBe(true);

    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.command('/commands/fail', {}, 'failing');
    });

    expect(succeeded).toBe(false);
    expect(result.current.pendingCommand).toBeNull();
    expect(result.current.error).toBe('Receiver rejected');
    unmount();
  });

  it('returns true after a successful command and refresh', async () => {
    const { result, unmount } = renderHook(() => useOControlApi('http://localhost:8787'));
    await flushInitialRefresh();
    expect(result.current.serviceReachable).toBe(true);

    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.command(
        '/commands/volume',
        { value: 35 },
        'volume:set',
      );
    });

    expect(succeeded).toBe(true);
    expect(result.current.pendingCommand).toBeNull();
    expect(result.current.error).toBeNull();
    unmount();
  });
});
