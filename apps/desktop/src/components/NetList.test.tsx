import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiverState } from '../test/fixtures';
import { NetList } from './NetList';
import type { LibraryNavigationTarget } from './NetList';

type RawResult = { ok: true } | { ok: false; error: string };

const command = vi.fn(async () => true);
const rawCommand = vi.fn(async (): Promise<RawResult> => ({ ok: true }));
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

function renderNetList(options: {
  serviceUrl?: string;
  state?: ReturnType<typeof receiverState>;
  navigationTarget?: LibraryNavigationTarget;
  onNavigationHandled?: () => void;
} = {}) {
  return render(
    <NetList
      state={options.state ?? receiverState()}
      pendingCommand={null}
      command={command}
      rawCommand={rawCommand}
      serviceUrl={options.serviceUrl ?? 'http://service-a:8787'}
      navigationTarget={options.navigationTarget}
      onNavigationHandled={options.onNavigationHandled}
    />,
  );
}

describe('NetList', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, String(value)),
    });
    command.mockClear();
    rawCommand.mockReset();
    rawCommand.mockResolvedValue({ ok: true });
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders an OSD command failure locally without alerting or leaking to global command state', async () => {
    localStorage.setItem('netlist_mode', 'osd');
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    rawCommand.mockResolvedValueOnce({ ok: false, error: 'OSD command rejected' });
    renderNetList({
      state: receiverState({
        netList: {
          title: 'Music Server',
          cursor: 0,
          totalItems: 1,
          items: [{ index: 0, name: 'Albums', type: 'folder' }],
        },
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open Albums' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('OSD command rejected');
    expect(rawCommand).toHaveBeenCalledWith(
      '/commands/list/action',
      { action: 'select', index: 0 },
      expect.any(AbortSignal),
    );
    expect(command).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('renders an empty OSD folder as empty after its title has loaded', async () => {
    localStorage.setItem('netlist_mode', 'osd');
    renderNetList({
      state: receiverState({
        netList: { title: 'Empty folder', cursor: -1, totalItems: 0, items: [] },
      }),
    });

    expect(await screen.findByText('This list is empty.')).toBeVisible();
    expect(screen.queryByText('Loading items...')).not.toBeInTheDocument();
  });

  it('uses the OSD navigation buttons to move the receiver selection', async () => {
    localStorage.setItem('netlist_mode', 'osd');
    renderNetList({
      state: receiverState({
        netList: {
          title: 'Music Server',
          cursor: 0,
          totalItems: 2,
          items: [
            { index: 0, name: 'Albums', type: 'folder' },
            { index: 1, name: 'Track.flac', type: 'file' },
          ],
        },
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Move selection down' }));

    await waitFor(() => expect(rawCommand).toHaveBeenCalledWith(
      '/commands/list/action',
      { action: 'down' },
      expect.any(AbortSignal),
    ));
  });

  it('renders a DLNA playback failure locally and never calls alert', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) {
        return jsonResponse({
          servers: [{ id: 'nas', friendlyName: 'Living Room NAS', host: '192.0.2.10' }],
        });
      }
      if (url.endsWith('/dlna/browse')) {
        return jsonResponse({
          items: [{
            id: 'track-1',
            parentId: '0',
            title: 'Blue in Green',
            type: 'item',
            resourceUrl: 'http://nas/track.flac',
            mimeType: 'audio/flac',
          }],
        });
      }
      if (url.endsWith('/dlna/play')) return jsonResponse('Receiver refused playback', false);
      throw new Error(`Unexpected fetch: ${url}`);
    });
    renderNetList();

    expect(screen.getByRole('button', { name: 'Folders' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Receiver list' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(await screen.findByRole('button', { name: 'Open media server Living Room NAS' }));
    expect(screen.queryByText('192.0.2.10')).not.toBeInTheDocument();
    expect(screen.queryByText(/items loaded|servers discovered/i)).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Play Blue in Green' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'AVTransport play failed. Make sure receiver is on Network input.',
    );
    expect(alertSpy).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  });

  it('passes the selected DLNA album artwork URI to the service', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) {
        return jsonResponse({
          servers: [{ id: 'nas', friendlyName: 'Artwork NAS', host: '192.0.2.10' }],
        });
      }
      if (url.endsWith('/dlna/browse')) {
        return jsonResponse({
          items: [{
            id: 'track-1',
            parentId: '0',
            title: 'Artwork track',
            type: 'item',
            resourceUrl: 'http://nas/track.flac',
            mimeType: 'audio/flac',
            albumArtURI: 'http://nas/art.jpg',
          }],
        });
      }
      if (url.endsWith('/dlna/play')) {
        const body = JSON.parse(String(init?.body)) as { albumArtURI?: string };
        expect(body.albumArtURI).toBe('http://nas/art.jpg');
        return jsonResponse({ success: true });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderNetList();
    fireEvent.click(await screen.findByRole('button', { name: 'Open media server Artwork NAS' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Play Artwork track' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/dlna/play'))).toBe(true));
  });

  it('routes Albums to the MusicServer album container and renders album detail tracks', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) {
        return jsonResponse({ servers: [{ id: 'nas', friendlyName: 'Catalog NAS', host: '192.0.2.10' }] });
      }
      if (url.endsWith('/dlna/browse')) {
        const body = JSON.parse(String(init?.body)) as { objectId: string };
        if (body.objectId === '0') return jsonResponse({ items: [{ id: 'albums', parentId: '0', title: '391 albums', type: 'container' }] });
        if (body.objectId === 'albums') return jsonResponse({ items: [{ id: 'album-1', parentId: 'albums', title: 'Album One', type: 'container', childCount: 2 }] });
        return jsonResponse({ items: [
          { id: 'track-1', parentId: 'album-1', title: 'First Track', type: 'item', artist: 'Artist One', album: 'Album One', resourceUrl: 'http://nas/1.flac' },
          { id: 'track-2', parentId: 'album-1', title: 'Second Track', type: 'item', artist: 'Artist One', album: 'Album One', resourceUrl: 'http://nas/2.flac' },
        ] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderNetList();
    fireEvent.click(await screen.findByRole('button', { name: 'Open media server Catalog NAS' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Albums' }));
    fireEvent.click(await screen.findByRole('button', { name: /Album One 2 items/ }));

    expect(await screen.findByRole('button', { name: 'Play Album' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Play First Track' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Play Second Track' })).toBeVisible();
  });

  it('opens a Home deep link directly at its album object', async () => {
    const onNavigationHandled = vi.fn();
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) return jsonResponse({ servers: [] });
      if (url.endsWith('/dlna/browse')) {
        const body = JSON.parse(String(init?.body)) as { objectId: string };
        expect(body.objectId).toBe('album-42');
        return jsonResponse({ items: [
          { id: 'track-1', parentId: 'album-42', title: 'Deep Track', type: 'item', artist: 'Artist', album: 'Deep Album', resourceUrl: 'http://nas/deep.flac' },
        ] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderNetList({
      navigationTarget: {
        server: { id: 'nas', friendlyName: 'Deep NAS', host: '192.0.2.10' },
        kind: 'albums',
        objectId: 'album-42',
        title: 'Deep Album',
      },
      onNavigationHandled,
    });

    expect(await screen.findByRole('button', { name: 'Play Deep Track' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Deep Album' })).toBeVisible();
    expect(onNavigationHandled).toHaveBeenCalledOnce();
  });

  it('preserves the selected folder when Library is reopened', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) {
        return jsonResponse({
          servers: [{ id: 'nas', friendlyName: 'Remembered NAS', host: '192.0.2.10' }],
        });
      }
      if (url.endsWith('/dlna/browse')) {
        const body = JSON.parse(String(init?.body)) as { objectId: string };
        return jsonResponse({
          items: body.objectId === '0'
            ? [{ id: 'album', parentId: '0', title: 'Remembered Album', type: 'container' }]
            : [{ id: 'track', parentId: 'album', title: 'Remembered Track', type: 'item', resourceUrl: 'http://nas/track.flac' }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const firstRender = renderNetList();
    fireEvent.click(await screen.findByRole('button', { name: 'Open media server Remembered NAS' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open folder Remembered Album' }));
    expect(await screen.findByRole('button', { name: 'Play Remembered Track' })).toBeVisible();

    firstRender.unmount();
    renderNetList();

    expect(await screen.findByRole('heading', { name: 'Remembered Album' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Play Remembered Track' })).toBeVisible();
    const browseBodies = fetchMock.mock.calls
      .filter(([input]) => String(input).endsWith('/dlna/browse'))
      .map(([, init]) => JSON.parse(String(init?.body)) as { objectId: string });
    expect(browseBodies.at(-1)?.objectId).toBe('album');
  });

  it('sends the current folder as a DLNA playlist for automatic next-track playback', async () => {
    let playBody: { resourceUrl: string; playlist?: Array<{ resourceUrl: string }> } | undefined;
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) {
        return jsonResponse({
          servers: [{ id: 'nas', friendlyName: 'Playlist NAS', host: '192.0.2.10' }],
        });
      }
      if (url.endsWith('/dlna/browse')) {
        return jsonResponse({
          items: [
            { id: 'track-1', parentId: '0', title: 'Track One', type: 'item', resourceUrl: 'http://nas/one.flac', mimeType: 'audio/flac' },
            { id: 'track-2', parentId: '0', title: 'Track Two', type: 'item', resourceUrl: 'http://nas/two.flac', mimeType: 'audio/flac' },
          ],
        });
      }
      if (url.endsWith('/dlna/play')) {
        playBody = JSON.parse(String(init?.body)) as { resourceUrl: string; playlist?: Array<{ resourceUrl: string }> };
        return jsonResponse({ success: true });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderNetList();
    fireEvent.click(await screen.findByRole('button', { name: 'Open media server Playlist NAS' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Play Track One' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/dlna/play'))).toBe(true));
    expect(playBody?.resourceUrl).toBe('http://nas/one.flac');
    expect(playBody?.playlist?.map((track) => track.resourceUrl)).toEqual([
      'http://nas/one.flac',
      'http://nas/two.flac',
    ]);
  });

  it('clears the retained scan timer and aborts requests when Library unmounts', async () => {
    vi.useFakeTimers();
    const serverResponse = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) return serverResponse.promise;
      if (url.endsWith('/dlna/scan')) return Promise.resolve(jsonResponse({ success: true }));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const { unmount } = renderNetList();
    await act(async () => Promise.resolve());

    fireEvent.click(screen.getByRole('button', { name: 'Scan network for DLNA servers' }));
    await act(async () => Promise.resolve());
    expect(vi.getTimerCount()).toBe(1);
    const fetchCountBeforeUnmount = fetchMock.mock.calls.length;
    const serverSignal = fetchMock.mock.calls.find(([input]) => (
      String(input).endsWith('/dlna/servers')
    ))?.[1]?.signal;

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(serverSignal?.aborted).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(fetchMock).toHaveBeenCalledTimes(fetchCountBeforeUnmount);
    serverResponse.resolve(jsonResponse({ servers: [] }));
  });

  it('ignores a server response from an obsolete service URL', async () => {
    const oldServers = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith('http://service-a:8787/')) return oldServers.promise;
      if (url.startsWith('http://service-b:8787/')) {
        return Promise.resolve(jsonResponse({
          servers: [{ id: 'new', friendlyName: 'New NAS', host: '192.0.2.20' }],
        }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const { rerender } = renderNetList();

    rerender(
      <NetList
        state={receiverState()}
        pendingCommand={null}
        command={command}
        rawCommand={rawCommand}
        serviceUrl="http://service-b:8787"
      />,
    );
    expect(await screen.findByRole('button', { name: 'Open media server New NAS' })).toBeVisible();

    await act(async () => {
      oldServers.resolve(jsonResponse({
        servers: [{ id: 'old', friendlyName: 'Old NAS', host: '192.0.2.30' }],
      }));
      await oldServers.promise;
    });
    expect(screen.queryByText('Old NAS')).not.toBeInTheDocument();
    expect(screen.getByText('New NAS')).toBeVisible();
  });

  it('ignores an obsolete folder response after navigating back', async () => {
    const staleFolder = deferred<Response>();
    let rootRequestCount = 0;
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) {
        return Promise.resolve(jsonResponse({
          servers: [{ id: 'nas', friendlyName: 'NAS', host: '192.0.2.10' }],
        }));
      }
      if (url.endsWith('/dlna/browse')) {
        const body = JSON.parse(String(init?.body)) as { objectId: string };
        if (body.objectId === 'folder-a') return staleFolder.promise;
        rootRequestCount += 1;
        return Promise.resolve(jsonResponse({
          items: rootRequestCount === 1
            ? [{ id: 'folder-a', parentId: '0', title: 'Folder A', type: 'container' }]
            : [{ id: 'current', parentId: '0', title: 'Current root track', type: 'item', resourceUrl: 'http://nas/current' }],
        }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    renderNetList();

    fireEvent.click(await screen.findByRole('button', { name: 'Open media server NAS' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open folder Folder A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(await screen.findByRole('button', { name: 'Play Current root track' })).toBeVisible();

    await act(async () => {
      staleFolder.resolve(jsonResponse({
        items: [{ id: 'stale', parentId: 'folder-a', title: 'Stale track', type: 'item', resourceUrl: 'http://nas/stale' }],
      }));
      await staleFolder.promise;
    });
    expect(screen.queryByText('Stale track')).not.toBeInTheDocument();
    expect(screen.getByText('Current root track')).toBeVisible();
  });

  it('ignores an obsolete playback failure after navigating to another folder', async () => {
    const stalePlayback = deferred<Response>();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) {
        return Promise.resolve(jsonResponse({
          servers: [{ id: 'nas', friendlyName: 'NAS', host: '192.0.2.10' }],
        }));
      }
      if (url.endsWith('/dlna/play')) return stalePlayback.promise;
      if (url.endsWith('/dlna/browse')) {
        const body = JSON.parse(String(init?.body)) as { objectId: string };
        return Promise.resolve(jsonResponse({
          items: body.objectId === '0'
            ? [
                { id: 'track', parentId: '0', title: 'Old track', type: 'item', resourceUrl: 'http://nas/old' },
                { id: 'folder', parentId: '0', title: 'Next folder', type: 'container' },
              ]
            : [{ id: 'next', parentId: 'folder', title: 'Next track', type: 'item', resourceUrl: 'http://nas/next' }],
        }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    renderNetList();

    fireEvent.click(await screen.findByRole('button', { name: 'Open media server NAS' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Play Old track' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open folder Next folder' }));
    expect(await screen.findByRole('button', { name: 'Play Next track' })).toBeVisible();

    await act(async () => {
      stalePlayback.resolve(jsonResponse('Stale playback failure', false));
      await stalePlayback.promise;
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('returns to a fresh server root after the receiver leaves and re-enters NET input', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) {
        return jsonResponse({
          servers: [{ id: 'nas', friendlyName: 'Fresh NAS', host: '192.0.2.50' }],
        });
      }
      if (url.endsWith('/dlna/browse')) {
        return jsonResponse({
          items: [{ id: 'track', parentId: '0', title: 'Old selection', type: 'item', resourceUrl: 'http://nas/old' }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const { rerender } = renderNetList();

    fireEvent.click(await screen.findByRole('button', { name: 'Open media server Fresh NAS' }));
    expect(await screen.findByRole('button', { name: 'Play Old selection' })).toBeVisible();

    rerender(
      <NetList
        state={receiverState({ input: 'cd' })}
        pendingCommand={null}
        command={command}
        rawCommand={rawCommand}
        serviceUrl="http://service-a:8787"
      />,
    );
    expect(screen.getByText('Music Server list is only available on Network or USB input.')).toBeVisible();

    rerender(
      <NetList
        state={receiverState({ input: 'net' })}
        pendingCommand={null}
        command={command}
        rawCommand={rawCommand}
        serviceUrl="http://service-a:8787"
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Choose a media server' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open media server Fresh NAS' })).toBeVisible();
    expect(screen.queryByText('Old selection')).not.toBeInTheDocument();
  });

  it('retries the failed browse in place without describing the folder as empty', async () => {
    let browseCount = 0;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) {
        return jsonResponse({
          servers: [{ id: 'nas', friendlyName: 'Retry NAS', host: '192.0.2.60' }],
        });
      }
      if (url.endsWith('/dlna/browse')) {
        browseCount += 1;
        return browseCount === 1
          ? jsonResponse('Browse unavailable', false)
          : jsonResponse({
              items: [{ id: 'recovered', parentId: '0', title: 'Recovered track', type: 'item', resourceUrl: 'http://nas/recovered' }],
            });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    renderNetList();

    fireEvent.click(await screen.findByRole('button', { name: 'Open media server Retry NAS' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to browse folder contents');
    expect(screen.queryByText('This folder is empty.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry browse' }));

    expect(await screen.findByRole('button', { name: 'Play Recovered track' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(browseCount).toBe(2);
  });

  it('exposes DLNA rows as named buttons with native keyboard activation semantics', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) {
        return jsonResponse({
          servers: [{ id: 'nas', friendlyName: 'Keyboard NAS', host: '192.0.2.40' }],
        });
      }
      if (url.endsWith('/dlna/browse')) {
        return jsonResponse({
          items: [{ id: 'folder', parentId: '0', title: 'Keyboard Folder', type: 'container' }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    renderNetList();

    const serverButton = await screen.findByRole('button', { name: 'Open media server Keyboard NAS' });
    expect(serverButton.tagName).toBe('BUTTON');
    expect(serverButton.querySelector('div')).toBeNull();
    serverButton.focus();
    fireEvent.click(serverButton, { detail: 0 });

    const folderButton = await screen.findByRole('button', { name: 'Open folder Keyboard Folder' });
    expect(folderButton.tagName).toBe('BUTTON');
    expect(folderButton.querySelector('div')).toBeNull();
    folderButton.focus();
    fireEvent.click(folderButton, { detail: 0 });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/dlna/browse'))).toHaveLength(2));
  });
});
