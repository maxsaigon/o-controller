import { useCallback, useEffect, useState } from 'react';
import { Disc3, Library, Loader2, Play, RefreshCw, Tags } from 'lucide-react';
import type { LibraryNavigationTarget } from './NetList';

interface DlnaServer {
  id: string;
  friendlyName: string;
  host: string;
}

interface DlnaContainer {
  id: string;
  parentId: string;
  title: string;
  type: 'container';
  childCount?: number;
  albumArtURI?: string;
}

interface DlnaItem {
  id: string;
  parentId: string;
  title: string;
  type: 'item';
  artist?: string;
  album?: string;
  albumArtURI?: string;
  resourceUrl?: string;
  mimeType?: string;
  size?: number;
}

type BrowseItem = DlnaContainer | DlnaItem;

interface Props {
  serviceUrl: string;
  serviceReachable?: boolean;
  onOpenLibrary: () => void;
  onNavigate: (target: LibraryNavigationTarget) => void;
}

const NAVIGATION_KEY = 'netlist_dlna_navigation';
const HOME_CACHE_VERSION = 1;

interface HomeCache {
  version: typeof HOME_CACHE_VERSION;
  serviceUrl: string;
  savedAt: number;
  server: DlnaServer;
  albums: DlnaContainer[];
  genres: DlnaContainer[];
}

function cacheKey(serviceUrl: string): string {
  return `o-control.library-home.v${HOME_CACHE_VERSION}:${serviceUrl}`;
}

function readHomeCache(serviceUrl: string): HomeCache | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey(serviceUrl)) ?? 'null') as Partial<HomeCache> | null;
    if (
      parsed?.version !== HOME_CACHE_VERSION
      || parsed.serviceUrl !== serviceUrl
      || !parsed.server
      || !Array.isArray(parsed.albums)
      || !Array.isArray(parsed.genres)
    ) return null;
    return parsed as HomeCache;
  } catch {
    return null;
  }
}

function writeHomeCache(cache: HomeCache): void {
  try {
    localStorage.setItem(cacheKey(cache.serviceUrl), JSON.stringify(cache));
  } catch {
    // The live library remains usable when WebView storage is unavailable.
  }
}

function preferredServerId(): string | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(NAVIGATION_KEY) ?? 'null') as { selectedServer?: { id?: unknown } } | null;
    return typeof parsed?.selectedServer?.id === 'string' ? parsed.selectedServer.id : null;
  } catch {
    return null;
  }
}

function isContainer(item: BrowseItem): item is DlnaContainer {
  return item.type === 'container';
}

function findCollection(items: BrowseItem[], pattern: RegExp): DlnaContainer | undefined {
  return items.find((item): item is DlnaContainer => isContainer(item) && pattern.test(item.title));
}

function Artwork({ serviceUrl, serverId, objectId, alt }: { serviceUrl: string; serverId: string; objectId: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="home-artwork-fallback"><Disc3 aria-hidden="true" /></span>;
  return (
    <img
      src={`${serviceUrl}/dlna/artwork?serverId=${encodeURIComponent(serverId)}&objectId=${encodeURIComponent(objectId)}`}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function LibraryHome({ serviceUrl, serviceReachable, onOpenLibrary, onNavigate }: Props) {
  const initialCache = readHomeCache(serviceUrl);
  const [server, setServer] = useState<DlnaServer | null>(initialCache?.server ?? null);
  const [albums, setAlbums] = useState<DlnaContainer[]>(initialCache?.albums ?? []);
  const [genres, setGenres] = useState<DlnaContainer[]>(initialCache?.genres ?? []);
  const [loading, setLoading] = useState(!initialCache);
  const [refreshing, setRefreshing] = useState(Boolean(initialCache));
  const [discoveryPending, setDiscoveryPending] = useState(false);
  const [artworkRevision, setArtworkRevision] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(async (serverId: string, objectId: string, signal?: AbortSignal) => {
    const response = await fetch(`${serviceUrl}/dlna/browse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, objectId }),
      signal,
    });
    if (!response.ok) throw new Error('Could not load the MusicServer library.');
    return (await response.json() as { items: BrowseItem[] }).items;
  }, [serviceUrl]);

  const loadHome = useCallback(async (signal?: AbortSignal, hasCachedData = false) => {
    setLoading(!hasCachedData);
    setRefreshing(hasCachedData);
    setDiscoveryPending(false);
    setError(null);
    try {
      const response = await fetch(`${serviceUrl}/dlna/servers`, { signal });
      if (!response.ok) throw new Error('Could not find a MusicServer.');
      const discovered = (await response.json() as { servers: DlnaServer[] }).servers;
      const preferred = preferredServerId();
      const nextServer = discovered.find((entry) => entry.id === preferred) ?? discovered[0];
      if (!nextServer) {
        await fetch(`${serviceUrl}/dlna/scan`, { method: 'POST', signal }).catch(() => undefined);
        if (!hasCachedData) {
          setServer(null);
          setAlbums([]);
          setGenres([]);
        }
        if (!signal?.aborted) setDiscoveryPending(true);
        return;
      }
      const root = await browse(nextServer.id, '0', signal);
      const albumsRoot = findCollection(root, /(?:^|\s)albums?$/i) ?? findCollection(root, /^\d+\s+albums?/i);
      const genresRoot = findCollection(root, /^(?:all\s+)?genres?$/i);
      const [albumItems, genreItems] = await Promise.all([
        albumsRoot ? browse(nextServer.id, albumsRoot.id, signal) : Promise.resolve([]),
        genresRoot ? browse(nextServer.id, genresRoot.id, signal) : Promise.resolve([]),
      ]);
      const nextAlbums = albumItems.filter(isContainer);
      const nextGenres = genreItems.filter(isContainer);
      setServer(nextServer);
      setAlbums(nextAlbums);
      setGenres(nextGenres);
      setArtworkRevision((current) => current + 1);
      writeHomeCache({
        version: HOME_CACHE_VERSION,
        serviceUrl,
        savedAt: Date.now(),
        server: nextServer,
        albums: nextAlbums,
        genres: nextGenres,
      });
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load Home.');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [browse, serviceUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readHomeCache(serviceUrl);
    setServer(cached?.server ?? null);
    setAlbums(cached?.albums ?? []);
    setGenres(cached?.genres ?? []);
    setArtworkRevision((current) => current + 1);
    void loadHome(controller.signal, Boolean(cached));
    return () => controller.abort();
  }, [loadHome, serviceReachable, serviceUrl]);

  useEffect(() => {
    if (!discoveryPending) return;
    const timer = window.setTimeout(() => {
      void loadHome(undefined, Boolean(server));
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [discoveryPending, loadHome, server]);

  function navigateTo(item: DlnaContainer, kind: 'albums' | 'genres') {
    if (!server) return;
    onNavigate({ server, kind, objectId: item.id, title: item.title });
  }

  async function playAlbum(album: DlnaContainer) {
    if (!server) return;
    setPlayingId(album.id);
    setError(null);
    try {
      const items = await browse(server.id, album.id);
      const tracks = items.filter((item): item is DlnaItem => item.type === 'item' && Boolean(item.resourceUrl));
      if (tracks.length === 0) throw new Error('This album has no playable tracks.');
      const first = tracks[0];
      const playlist = tracks.map((track) => ({
        resourceUrl: track.resourceUrl as string,
        title: track.title,
        artist: track.artist,
        album: track.album,
        mimeType: track.mimeType,
        albumArtURI: track.albumArtURI,
        size: track.size,
      }));
      const response = await fetch(`${serviceUrl}/dlna/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...playlist[0], playlist: playlist.length > 1 ? playlist : undefined }),
      });
      if (!response.ok) throw new Error('Could not play this album. Switch the receiver to Network input and retry.');
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : 'Could not play this album.');
    } finally {
      setPlayingId(null);
    }
  }

  const renderAlbum = (album: DlnaContainer) => (
    <article className="home-album-card" key={album.id}>
      <div className="home-album-art-wrap">
        <button className="home-album-art" type="button" onClick={() => navigateTo(album, 'albums')} aria-label={`Open ${album.title}`}>
          {server ? <Artwork key={`${album.id}:${artworkRevision}`} serviceUrl={serviceUrl} serverId={server.id} objectId={album.id} alt={`${album.title} artwork`} /> : null}
        </button>
        <button className="home-card-play" type="button" disabled={playingId === album.id} onClick={() => void playAlbum(album)} aria-label={`Play ${album.title}`}>{playingId === album.id ? <Loader2 className="animate-spin" size={17} /> : <Play size={17} fill="currentColor" />}</button>
      </div>
      <button className="home-album-title" type="button" onClick={() => navigateTo(album, 'albums')}>{album.title}</button>
      <span>{album.childCount ? `${album.childCount} tracks` : 'Album'}</span>
    </article>
  );

  return (
    <section className="library-home" aria-label="Home">
      <header className="home-heading">
        <div><h2>Good evening</h2><p>Your music, ready to play · {server ? `${albums.length} albums on ${server.friendlyName}` : loading ? 'Loading MusicServer…' : 'MusicServer is not available yet.'}{refreshing ? ' · Updating…' : ''}</p></div>
        <button type="button" className="home-browse-button" onClick={onOpenLibrary}><Library size={16} /> Browse library</button>
      </header>

      {error ? <div className={`home-error ${server ? 'home-error-muted' : ''}`} role="alert"><span>{server ? 'Showing saved library data.' : error}</span><button type="button" onClick={() => void loadHome(undefined, Boolean(server))}><RefreshCw size={13} /> Retry</button></div> : null}

      {loading ? <div className="home-loading"><Loader2 className="animate-spin" /><p>Loading your library…</p></div> : null}

      {!loading && !server ? <div className="home-empty"><Disc3 size={36} /><h3>No MusicServer found</h3><p>Home checks for your server automatically. Retry when it is ready.</p><button type="button" onClick={() => void loadHome()}>Retry</button></div> : null}

      {server && albums.length > 0 ? <section className="home-section"><div className="home-section-heading"><div><h3>Explore your library</h3></div><button type="button" onClick={onOpenLibrary}>See all</button></div><div className="home-album-shelf">{albums.slice(0, 8).map(renderAlbum)}</div></section> : null}

      {server && genres.length > 0 ? <section className="home-section home-genres"><div className="home-section-heading"><div><h3>Browse by genre</h3></div></div><div className="home-genre-grid">{genres.slice(0, 10).map((genre) => <button key={genre.id} type="button" className="home-genre-card" onClick={() => navigateTo(genre, 'genres')}><Tags size={14} /><strong>{genre.title}</strong></button>)}</div></section> : null}
    </section>
  );
}
