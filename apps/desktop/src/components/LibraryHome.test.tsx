import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryHome } from './LibraryHome';

function response(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body } as Response);
}

describe('LibraryHome', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, String(value)),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads real album and genre containers from the MusicServer root', async () => {
    const onNavigate = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) return response({ servers: [{ id: 'server-1', friendlyName: 'MinimServer', host: 'nas' }] });
      const body = JSON.parse(String(init?.body)) as { objectId: string };
      if (body.objectId === '0') return response({ items: [{ id: 'albums', parentId: '0', title: '392 albums', type: 'container' }, { id: 'genres', parentId: '0', title: 'Genre', type: 'container' }] });
      if (body.objectId === 'albums') return response({ items: [{ id: 'blue', parentId: 'albums', title: 'Kind of Blue', type: 'container', childCount: 5 }] });
      if (body.objectId === 'genres') return response({ items: [{ id: 'jazz', parentId: 'genres', title: 'Jazz', type: 'container', childCount: 42 }] });
      return response({ items: [] });
    });

    render(<LibraryHome serviceUrl="http://localhost:8787" onOpenLibrary={vi.fn()} onNavigate={onNavigate} />);

    expect((await screen.findAllByText('Kind of Blue')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Jazz/ })).toBeVisible();
    expect(screen.getByText(/1 albums on MinimServer/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Open Kind of Blue' }));
    expect(onNavigate).toHaveBeenCalledWith({
      server: { id: 'server-1', friendlyName: 'MinimServer', host: 'nas' },
      kind: 'albums',
      objectId: 'blue',
      title: 'Kind of Blue',
    });
  });

  it('deep-links a selected genre into Library', async () => {
    const onNavigate = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).endsWith('/dlna/servers')) return response({ servers: [{ id: 'server-1', friendlyName: 'NAS', host: 'nas' }] });
      const body = JSON.parse(String(init?.body)) as { objectId: string };
      const items: Record<string, unknown[]> = {
        '0': [{ id: 'albums', parentId: '0', title: 'Albums', type: 'container' }, { id: 'genres', parentId: '0', title: 'Genres', type: 'container' }],
        albums: [{ id: 'album-1', parentId: 'albums', title: 'First Album', type: 'container' }],
        genres: [{ id: 'jazz', parentId: 'genres', title: 'Jazz', type: 'container' }],
        jazz: [{ id: 'jazz-album', parentId: 'jazz', title: 'Blue Train', type: 'container' }],
      };
      return response({ items: items[body.objectId] ?? [] });
    });

    render(<LibraryHome serviceUrl="http://localhost:8787" onOpenLibrary={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Jazz/ }));

    expect(onNavigate).toHaveBeenCalledWith({
      server: { id: 'server-1', friendlyName: 'NAS', host: 'nas' },
      kind: 'genres',
      objectId: 'jazz',
      title: 'Jazz',
    });
  });

  it('browses album tracks and sends the existing DLNA playlist payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/dlna/servers')) return response({ servers: [{ id: 'server-1', friendlyName: 'NAS', host: 'nas' }] });
      if (url.endsWith('/dlna/play')) return response({ success: true });
      const body = JSON.parse(String(init?.body)) as { objectId: string };
      if (body.objectId === '0') return response({ items: [{ id: 'albums', parentId: '0', title: 'Albums', type: 'container' }] });
      if (body.objectId === 'albums') return response({ items: [{ id: 'album-1', parentId: 'albums', title: 'Album One', type: 'container' }] });
      if (body.objectId === 'album-1') return response({ items: [
        { id: 'track-1', parentId: 'album-1', title: 'Track One', type: 'item', resourceUrl: 'http://nas/1.flac', artist: 'Artist' },
        { id: 'track-2', parentId: 'album-1', title: 'Track Two', type: 'item', resourceUrl: 'http://nas/2.flac', artist: 'Artist' },
      ] });
      return response({ items: [] });
    });

    render(<LibraryHome serviceUrl="http://localhost:8787" onOpenLibrary={vi.fn()} onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Play Album One' }));

    await waitFor(() => {
      const playCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/dlna/play'));
      expect(playCall).toBeDefined();
      const payload = JSON.parse(String(playCall?.[1]?.body)) as { resourceUrl: string; playlist: unknown[] };
      expect(payload.resourceUrl).toBe('http://nas/1.flac');
      expect(payload.playlist).toHaveLength(2);
    });
  });

  it('shows a truthful empty state when no MusicServer is discovered', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(response({ servers: [] }));
    render(<LibraryHome serviceUrl="http://localhost:8787" onOpenLibrary={vi.fn()} onNavigate={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'No MusicServer found' })).toBeVisible();
  });

  it('renders cached MusicServer data immediately while refreshing in the background', () => {
    localStorage.setItem('o-control.library-home.v1:http://localhost:8787', JSON.stringify({
      version: 1,
      serviceUrl: 'http://localhost:8787',
      savedAt: Date.now(),
      server: { id: 'cached-server', friendlyName: 'MinimServer', host: 'nas' },
      albums: [{ id: 'cached-album', parentId: 'albums', title: 'Cached Album', type: 'container', childCount: 9 }],
      genres: [{ id: 'cached-genre', parentId: 'genres', title: 'Ambient', type: 'container' }],
    }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

    render(<LibraryHome serviceUrl="http://localhost:8787" onOpenLibrary={vi.fn()} onNavigate={vi.fn()} />);

    expect(screen.getByText('Cached Album')).toBeVisible();
    expect(screen.getByRole('button', { name: /Ambient/ })).toBeVisible();
    expect(screen.getByText(/Updating/)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8787/dlna/servers', expect.any(Object));
  });
});
