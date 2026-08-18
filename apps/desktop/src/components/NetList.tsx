import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Folder, Music, Play, Plus, ChevronLeft, ChevronUp, ChevronDown, Loader2, RefreshCw, Server, ListMusic, Disc3, Users, Tags } from 'lucide-react';
import type { OControlState } from '@o-control/shared';
import type { RawCommandResult } from '../ui/useOControlApi';

interface NetListProps {
  state: OControlState;
  pendingCommand: string | null;
  command: (path: string, body: unknown, label: string) => Promise<boolean>;
  rawCommand: (path: string, body: unknown, signal?: AbortSignal) => Promise<RawCommandResult>;
  serviceUrl: string;
  navigationTarget?: LibraryNavigationTarget | null;
  onNavigationHandled?: () => void;
}

export interface LibraryNavigationTarget {
  server: DLNAServer;
  kind: 'albums' | 'genres';
  objectId: string;
  title: string;
}

export interface DLNAServer {
  id: string;
  friendlyName: string;
  host: string;
}

interface DLNAContainer {
  id: string;
  parentId: string;
  title: string;
  type: 'container';
  childCount?: number;
  albumArtURI?: string;
}

interface DLNAItem {
  id: string;
  parentId: string;
  title: string;
  type: 'item';
  artist?: string;
  album?: string;
  duration?: string;
  albumArtURI?: string;
  resourceUrl?: string;
  mimeType?: string;
  size?: number;
}

type DLNABrowseElement = DLNAContainer | DLNAItem;
type FailedBrowse = { serverId: string; objectId: string };

function CatalogArtwork({ serviceUrl, serverId, objectId, alt, fallback }: {
  serviceUrl: string;
  serverId: string;
  objectId: string;
  alt: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  const src = `${serviceUrl}/dlna/artwork?serverId=${encodeURIComponent(serverId)}&objectId=${encodeURIComponent(objectId)}`;
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

const DLNA_NAVIGATION_STORAGE_KEY = 'netlist_dlna_navigation';

interface PersistedDlnaNavigation {
  selectedServer: DLNAServer;
  folderHistory: string[];
  folderTitleHistory: string[];
}

function readPersistedDlnaNavigation(): PersistedDlnaNavigation | null {
  try {
    const raw = localStorage.getItem(DLNA_NAVIGATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedDlnaNavigation>;
    if (
      !parsed.selectedServer
      || typeof parsed.selectedServer.id !== 'string'
      || typeof parsed.selectedServer.friendlyName !== 'string'
      || typeof parsed.selectedServer.host !== 'string'
      || !Array.isArray(parsed.folderHistory)
      || !Array.isArray(parsed.folderTitleHistory)
      || parsed.folderHistory.length !== parsed.folderTitleHistory.length
      || parsed.folderHistory.length === 0
      || parsed.folderHistory.some((value) => typeof value !== 'string')
      || parsed.folderTitleHistory.some((value) => typeof value !== 'string')
    ) {
      return null;
    }
    return parsed as PersistedDlnaNavigation;
  } catch {
    return null;
  }
}

function formatDlnaDuration(value?: string): string {
  if (!value) return '--:--';
  const match = value.match(/^(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (!match) return value;
  const totalMinutes = Number(match[1]) * 60 + Number(match[2]);
  return `${String(totalMinutes).padStart(2, '0')}:${match[3]}`;
}

export const NetList: React.FC<NetListProps> = ({
  state,
  pendingCommand,
  command,
  rawCommand,
  serviceUrl,
  navigationTarget,
  onNavigationHandled,
}) => {
  const isNetOrUsb = state.input === 'net' || state.input === 'usb';
  const { title: osdTitle, items: osdItems, cursor: osdCursor } = state.netList;
  const listRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef<number>(0);
  const mounted = useRef(false);
  const lifecycleGeneration = useRef(0);
  const requestControllers = useRef(new Set<AbortController>());
  const scanTimer = useRef<number | null>(null);
  const serverGeneration = useRef(0);
  const scanGeneration = useRef(0);
  const browseGeneration = useRef(0);
  const playGeneration = useRef(0);
  const osdGeneration = useRef(0);
  const initialNavigation = useRef(readPersistedDlnaNavigation());
  const restoredBrowse = useRef(false);
  const browseController = useRef<AbortController | null>(null);
  const playController = useRef<AbortController | null>(null);

  // ── DLNA State ────────────────────────────────────────────────
  const [mode, setMode] = useState<'dlna' | 'osd'>(() => {
    const saved = localStorage.getItem('netlist_mode');
    return (saved === 'dlna' || saved === 'osd') ? saved : 'dlna';
  });
  const [libraryView, setLibraryView] = useState<'folders' | 'albums' | 'artists' | 'genres'>('folders');
  const [pendingLibraryRoot, setPendingLibraryRoot] = useState<'albums' | 'artists' | 'genres' | null>(null);

  const [servers, setServers] = useState<DLNAServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<DLNAServer | null>(
    () => initialNavigation.current?.selectedServer ?? null,
  );
  const [dlnaItems, setDlnaItems] = useState<DLNABrowseElement[]>([]);
  const [rootItems, setRootItems] = useState<DLNABrowseElement[]>([]);
  const [folderHistory, setFolderHistory] = useState<string[]>(
    () => initialNavigation.current?.folderHistory ?? ['0'],
  );
  const [folderTitleHistory, setFolderTitleHistory] = useState<string[]>(
    () => initialNavigation.current?.folderTitleHistory ?? ['Root'],
  );
  const [loadingServers, setLoadingServers] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [failedBrowse, setFailedBrowse] = useState<FailedBrowse | null>(null);
  const [playingItemUrl, setPlayingItemUrl] = useState<string | null>(null);
  const [osdPending, setOsdPending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const trackController = useCallback(() => {
    const controller = new AbortController();
    requestControllers.current.add(controller);
    return controller;
  }, []);

  const releaseController = useCallback((controller: AbortController) => {
    requestControllers.current.delete(controller);
  }, []);

  const cancelRequests = useCallback(() => {
    if (scanTimer.current !== null) {
      window.clearTimeout(scanTimer.current);
      scanTimer.current = null;
    }
    for (const controller of requestControllers.current) controller.abort();
    requestControllers.current.clear();
    browseController.current = null;
    playController.current = null;
    serverGeneration.current += 1;
    scanGeneration.current += 1;
    browseGeneration.current += 1;
    playGeneration.current += 1;
    osdGeneration.current += 1;
  }, []);

  useEffect(() => {
    const lifecycle = lifecycleGeneration.current + 1;
    lifecycleGeneration.current = lifecycle;
    const savedNavigation = readPersistedDlnaNavigation();
    initialNavigation.current = savedNavigation;
    restoredBrowse.current = false;
    mounted.current = true;
    cancelRequests();
    setServers([]);
    setSelectedServer(savedNavigation?.selectedServer ?? null);
    setDlnaItems([]);
    setRootItems([]);
    setFolderHistory(savedNavigation?.folderHistory ?? ['0']);
    setFolderTitleHistory(savedNavigation?.folderTitleHistory ?? ['Root']);
    setLoadingServers(false);
    setLoadingContent(false);
    setScanning(false);
    setPlayingItemUrl(null);
    setOsdPending(false);
    setLibraryError(null);
    setFailedBrowse(null);
    setSearchQuery('');

    return () => {
      if (lifecycleGeneration.current === lifecycle) {
        mounted.current = false;
        lifecycleGeneration.current += 1;
        cancelRequests();
      }
    };
  }, [cancelRequests, serviceUrl]);

  useEffect(() => {
    if (!selectedServer) {
      localStorage.removeItem(DLNA_NAVIGATION_STORAGE_KEY);
      return;
    }
    const navigation: PersistedDlnaNavigation = {
      selectedServer,
      folderHistory,
      folderTitleHistory,
    };
    localStorage.setItem(DLNA_NAVIGATION_STORAGE_KEY, JSON.stringify(navigation));
  }, [folderHistory, folderTitleHistory, selectedServer]);

  // Persistence of mode
  useEffect(() => {
    localStorage.setItem('netlist_mode', mode);
  }, [mode]);

  // Fetch DLNA Servers
  const fetchServers = useCallback(async () => {
    const lifecycle = lifecycleGeneration.current;
    const request = serverGeneration.current + 1;
    serverGeneration.current = request;
    const controller = trackController();
    const isCurrent = () => (
      mounted.current
      && lifecycleGeneration.current === lifecycle
      && serverGeneration.current === request
      && !controller.signal.aborted
    );
    setLoadingServers(true);
    setLibraryError(null);
    try {
      const res = await fetch(`${serviceUrl}/dlna/servers`, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to load media servers');
      const data = await res.json() as { servers: DLNAServer[] };
      if (isCurrent()) setServers(data.servers);
    } catch (err) {
      if (isCurrent()) {
        setLibraryError(err instanceof Error ? err.message : 'Failed to query DLNA servers');
      }
    } finally {
      releaseController(controller);
      if (isCurrent()) setLoadingServers(false);
    }
  }, [releaseController, serviceUrl, trackController]);

  // Scan for DLNA Servers
  const scanServers = async () => {
    const lifecycle = lifecycleGeneration.current;
    const request = scanGeneration.current + 1;
    scanGeneration.current = request;
    const controller = trackController();
    const isCurrent = () => (
      mounted.current
      && lifecycleGeneration.current === lifecycle
      && scanGeneration.current === request
      && !controller.signal.aborted
    );
    setScanning(true);
    setLibraryError(null);
    try {
      const res = await fetch(`${serviceUrl}/dlna/scan`, {
        method: 'POST',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Failed to trigger scan');
      if (!isCurrent()) return;
      // Wait a moment for SSDP to discover and write to database, then fetch
      scanTimer.current = window.setTimeout(() => {
        scanTimer.current = null;
        void fetchServers().finally(() => {
          if (isCurrent()) setScanning(false);
        });
      }, 1500);
    } catch (err) {
      if (isCurrent()) {
        setLibraryError(err instanceof Error ? err.message : 'Scan trigger failed');
        setScanning(false);
      }
    } finally {
      releaseController(controller);
    }
  };

  // Browse a DLNA Folder
  const browseFolder = useCallback(async (serverId: string, objectId: string) => {
    browseController.current?.abort();
    playController.current?.abort();
    playController.current = null;
    playGeneration.current += 1;
    setPlayingItemUrl(null);
    const lifecycle = lifecycleGeneration.current;
    const request = browseGeneration.current + 1;
    browseGeneration.current = request;
    const controller = trackController();
    browseController.current = controller;
    const isCurrent = () => (
      mounted.current
      && lifecycleGeneration.current === lifecycle
      && browseGeneration.current === request
      && !controller.signal.aborted
    );
    setLoadingContent(true);
    setLibraryError(null);
    setFailedBrowse(null);
    setDlnaItems([]);
    try {
      const res = await fetch(`${serviceUrl}/dlna/browse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, objectId }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Failed to browse folder contents');
      const data = await res.json() as { items: DLNABrowseElement[] };
      if (isCurrent()) {
        setDlnaItems(data.items);
        if (objectId === '0') setRootItems(data.items);
      }
    } catch (err) {
      if (isCurrent()) {
        setLibraryError(err instanceof Error ? err.message : 'Folder query failed');
        setFailedBrowse({ serverId, objectId });
      }
    } finally {
      releaseController(controller);
      if (browseController.current === controller) browseController.current = null;
      if (isCurrent()) setLoadingContent(false);
    }
  }, [releaseController, serviceUrl, trackController]);

  useEffect(() => {
    if (!navigationTarget) return;
    cancelRequests();
    restoredBrowse.current = true;
    setMode('dlna');
    setLibraryView(navigationTarget.kind);
    setSelectedServer(navigationTarget.server);
    setRootItems([]);
    setFolderHistory(['0', navigationTarget.objectId]);
    setFolderTitleHistory(['Root', navigationTarget.title]);
    setSearchQuery('');
    void browseFolder(navigationTarget.server.id, navigationTarget.objectId);
    onNavigationHandled?.();
  }, [browseFolder, cancelRequests, navigationTarget, onNavigationHandled]);

  // Trigger Play via DLNA AVTransport
  const playTrack = async (item: DLNAItem, queueItems = dlnaItems) => {
    if (!item.resourceUrl) return;
    playController.current?.abort();
    const lifecycle = lifecycleGeneration.current;
    const request = playGeneration.current + 1;
    playGeneration.current = request;
    const controller = trackController();
    playController.current = controller;
    const isCurrent = () => (
      mounted.current
      && lifecycleGeneration.current === lifecycle
      && playGeneration.current === request
      && !controller.signal.aborted
    );
    setPlayingItemUrl(item.resourceUrl);
    setLibraryError(null);
    const playlist = queueItems
      .filter((entry): entry is DLNAItem => entry.type === 'item' && Boolean(entry.resourceUrl))
      .map((track) => ({
        resourceUrl: track.resourceUrl as string,
        title: track.title,
        artist: track.artist,
        album: track.album,
        mimeType: track.mimeType,
        albumArtURI: track.albumArtURI,
        size: track.size,
      }));
    try {
      const res = await fetch(`${serviceUrl}/dlna/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceUrl: item.resourceUrl,
          title: item.title,
          artist: item.artist,
          album: item.album,
          mimeType: item.mimeType,
          albumArtURI: item.albumArtURI,
          size: item.size,
          playlist: playlist.length > 1 ? playlist : undefined,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error('AVTransport play failed. Make sure receiver is on Network input.');
      }
    } catch (err) {
      if (isCurrent()) {
        setLibraryError(err instanceof Error ? err.message : 'Could not play selected track.');
      }
    } finally {
      releaseController(controller);
      if (playController.current === controller) playController.current = null;
      if (isCurrent()) setPlayingItemUrl(null);
    }
  };

  // ── DLNA Navigation Actions ──────────────────────────────────
  const handleSelectServer = (server: DLNAServer) => {
    cancelRequests();
    restoredBrowse.current = true;
    setLoadingServers(false);
    setScanning(false);
    setSelectedServer(server);
    setRootItems([]);
    setFolderHistory(['0']);
    setFolderTitleHistory(['Root']);
    setPendingLibraryRoot(libraryView === 'folders' ? null : libraryView);
    void browseFolder(server.id, '0');
  };

  const handleSelectFolder = (container: DLNAContainer) => {
    setSearchQuery('');
    const nextHistory = [...folderHistory, container.id];
    const nextTitleHistory = [...folderTitleHistory, container.title];
    setFolderHistory(nextHistory);
    setFolderTitleHistory(nextTitleHistory);
    void browseFolder(selectedServer!.id, container.id);
  };

  const openLibraryView = (view: 'folders' | 'albums' | 'artists' | 'genres') => {
    setLibraryView(view);
    setSearchQuery('');
    if (!selectedServer) return;
    if (view === 'folders') {
      if (folderHistory[folderHistory.length - 1] !== '0') {
        setFolderHistory(['0']);
        setFolderTitleHistory(['Root']);
        void browseFolder(selectedServer.id, '0');
      }
      return;
    }
    if (rootItems.length === 0) {
      setPendingLibraryRoot(view);
      setFolderHistory(['0']);
      setFolderTitleHistory(['Root']);
      void browseFolder(selectedServer.id, '0');
      return;
    }
    const candidates = rootItems.filter((item): item is DLNAContainer => item.type === 'container');
    const target = view === 'albums'
      ? candidates.find((item) => /albums?$/i.test(item.title) || /^\d+\s+albums?/i.test(item.title))
      : view === 'artists'
        ? candidates.find((item) => /^(all\s+)?artists?$/i.test(item.title))
        : candidates.find((item) => /^(all\s+)?genres?$/i.test(item.title));
    if (!target || folderHistory[folderHistory.length - 1] === target.id) return;
    setFolderHistory(['0', target.id]);
    setFolderTitleHistory(['Root', target.title]);
    void browseFolder(selectedServer.id, target.id);
  };

  useEffect(() => {
    if (!pendingLibraryRoot || !selectedServer || rootItems.length === 0) return;
    const target = rootItems.find((item): item is DLNAContainer => item.type === 'container' && (
      pendingLibraryRoot === 'albums'
        ? /albums?$/i.test(item.title) || /^\d+\s+albums?/i.test(item.title)
        : pendingLibraryRoot === 'artists'
          ? /^(all\s+)?artists?$/i.test(item.title)
          : /^(all\s+)?genres?$/i.test(item.title)
    ));
    setPendingLibraryRoot(null);
    if (!target) return;
    setFolderHistory(['0', target.id]);
    setFolderTitleHistory(['Root', target.title]);
    void browseFolder(selectedServer.id, target.id);
  }, [browseFolder, pendingLibraryRoot, rootItems, selectedServer]);

  const handleDlnaBack = () => {
    setSearchQuery('');
    if (folderHistory.length > 1) {
      const nextHistory = folderHistory.slice(0, -1);
      const nextTitleHistory = folderTitleHistory.slice(0, -1);
      setFolderHistory(nextHistory);
      setFolderTitleHistory(nextTitleHistory);
      void browseFolder(selectedServer!.id, nextHistory[nextHistory.length - 1]);
    } else {
      cancelRequests();
      restoredBrowse.current = true;
      setLoadingContent(false);
      setPlayingItemUrl(null);
      setSelectedServer(null);
      setDlnaItems([]);
      setFailedBrowse(null);
    }
  };

  const handleBreadcrumb = (index: number) => {
    if (!selectedServer || index < 0 || index >= folderHistory.length - 1) return;
    setSearchQuery('');
    const nextHistory = folderHistory.slice(0, index + 1);
    const nextTitles = folderTitleHistory.slice(0, index + 1);
    setFolderHistory(nextHistory);
    setFolderTitleHistory(nextTitles);
    void browseFolder(selectedServer.id, nextHistory[index]);
  };

  // Initial load of servers
  useEffect(() => {
    if (isNetOrUsb && mode === 'dlna') {
      void fetchServers();
    }
  }, [isNetOrUsb, mode, fetchServers]);

  useEffect(() => {
    if (
      !isNetOrUsb
      || mode !== 'dlna'
      || !selectedServer
      || restoredBrowse.current
      || initialNavigation.current?.selectedServer.id !== selectedServer.id
    ) {
      return;
    }
    restoredBrowse.current = true;
    void browseFolder(selectedServer.id, folderHistory[folderHistory.length - 1] ?? '0');
  }, [browseFolder, folderHistory, isNetOrUsb, mode, selectedServer]);

  useEffect(() => {
    if (isNetOrUsb) return;
    cancelRequests();
    setLoadingServers(false);
    setLoadingContent(false);
    setScanning(false);
    setPlayingItemUrl(null);
    setOsdPending(false);
    setServers([]);
    setSelectedServer(null);
    setDlnaItems([]);
    setFolderHistory(['0']);
    setFolderTitleHistory(['Root']);
    restoredBrowse.current = true;
    setLibraryError(null);
    setFailedBrowse(null);
  }, [cancelRequests, isNetOrUsb]);

  const runOsdCommand = useCallback(async (path: string, body: unknown) => {
    const lifecycle = lifecycleGeneration.current;
    const request = osdGeneration.current + 1;
    osdGeneration.current = request;
    const controller = trackController();
    const isCurrent = () => (
      mounted.current
      && lifecycleGeneration.current === lifecycle
      && osdGeneration.current === request
      && !controller.signal.aborted
    );
    setLibraryError(null);
    setOsdPending(true);
    try {
      const result = await rawCommand(path, body, controller.signal);
      if (isCurrent() && !result.ok) setLibraryError(result.error);
      return result.ok;
    } finally {
      releaseController(controller);
      if (isCurrent()) setOsdPending(false);
    }
  }, [rawCommand, releaseController, trackController]);

  // ── OSD Mode Event Handlers ──────────────────────────────────
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (mode !== 'osd' || !isNetOrUsb || osdItems.length === 0) return;

    const now = Date.now();
    if (now - lastScrollTime.current < 120) return;

    if (e.deltaY > 0) {
      lastScrollTime.current = now;
      void runOsdCommand('/commands/list/action', { action: 'down' });
    } else if (e.deltaY < 0) {
      lastScrollTime.current = now;
      void runOsdCommand('/commands/list/action', { action: 'up' });
    }
  };

  useEffect(() => {
    if (mode === 'osd' && isNetOrUsb && osdItems.length === 0) {
      void runOsdCommand('/commands/list/query', {});
    }
  }, [mode, isNetOrUsb, osdItems.length, runOsdCommand]);

  useEffect(() => {
    if (mode !== 'osd' || !isNetOrUsb) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        void runOsdCommand('/commands/list/action', { action: 'up' });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        void runOsdCommand('/commands/list/action', { action: 'down' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (osdCursor >= 0 && osdCursor < osdItems.length) {
          void runOsdCommand('/commands/list/action', { action: 'enter' });
        }
      } else if (e.key === 'Backspace' || e.key === 'ArrowLeft') {
        e.preventDefault();
        void runOsdCommand('/commands/list/action', { action: 'back' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode, isNetOrUsb, osdItems, osdCursor, runOsdCommand]);

  useEffect(() => {
    if (mode === 'osd' && osdCursor >= 0 && listRef.current) {
      const selectedEl = listRef.current.querySelector('.netlist-item.selected');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [mode, osdCursor]);

  // ── Render Helpers ───────────────────────────────────────────
  const handleSwitchInput = () => {
    void command('/commands/input', { input: 'net' }, 'Switch to Network');
  };

  const handleOsdBack = () => {
    void runOsdCommand('/commands/list/action', { action: 'back' });
  };

  const handleOsdSelectItem = (index: number) => {
    void runOsdCommand('/commands/list/action', { action: 'select', index });
  };

  const handleModeChange = (nextMode: 'dlna' | 'osd') => {
    if (nextMode === mode) return;
    cancelRequests();
    setLoadingServers(false);
    setLoadingContent(false);
    setScanning(false);
    setPlayingItemUrl(null);
    setOsdPending(false);
    setLibraryError(null);
    setFailedBrowse(null);
    setMode(nextMode);
  };

  const handleLibraryViewChange = (view: 'folders' | 'albums' | 'artists' | 'genres') => {
    handleModeChange('dlna');
    openLibraryView(view);
  };

  if (!isNetOrUsb) {
    return (
      <div className="sheet-panel list-warning-panel">
        <div className="list-warning-content">
          <p>Music Server list is only available on Network or USB input.</p>
          <button className="primary-button switch-input-btn" onClick={handleSwitchInput}>
            Switch to Network Input
          </button>
        </div>
      </div>
    );
  }

  const currentFolderTitle = folderTitleHistory[folderTitleHistory.length - 1];
  const isCollectionRoot = folderHistory.length === 2 && (
    (libraryView === 'albums' && (/(?:^|\s)albums?$/i.test(currentFolderTitle) || /^\d+\s+albums?/i.test(currentFolderTitle)))
    || (libraryView === 'artists' && /^(?:all\s+)?artists?$/i.test(currentFolderTitle))
    || (libraryView === 'genres' && /^(?:all\s+)?genres?$/i.test(currentFolderTitle))
  );
  const libraryTitle = currentFolderTitle === 'Root'
    ? selectedServer?.friendlyName ?? 'Folders'
    : isCollectionRoot
      ? libraryView[0].toUpperCase() + libraryView.slice(1)
      : currentFolderTitle;
  const playableItems = dlnaItems.filter((entry): entry is DLNAItem => entry.type === 'item' && Boolean(entry.resourceUrl));
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const visibleBrowseItems = dlnaItems.filter((item) => !normalizedSearch || [item.title, item.type === 'item' ? item.artist : undefined, item.type === 'item' ? item.album : undefined].filter(Boolean).some((value) => value!.toLocaleLowerCase().includes(normalizedSearch)));
  const visibleContainers = dlnaItems.filter((item): item is DLNAContainer => item.type === 'container' && (!normalizedSearch || item.title.toLocaleLowerCase().includes(normalizedSearch)));
  const visibleTracks = playableItems.filter((item) => !normalizedSearch || [item.title, item.artist, item.album].filter(Boolean).some((value) => value!.toLocaleLowerCase().includes(normalizedSearch)));

  return (
    <div className="sheet-panel netlist-panel">
      <div className="library-toolbar">
        <div className="netlist-tabs" role="group" aria-label="Library views">
          {(['folders', 'albums', 'artists', 'genres'] as const).map((view) => (
            <button
              key={view}
              className={`netlist-tab ${mode === 'dlna' && libraryView === view ? 'active' : ''}`}
              onClick={() => handleLibraryViewChange(view)}
              type="button"
              aria-pressed={mode === 'dlna' && libraryView === view}
            >
              {view[0].toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
        <button
          className={`library-receiver-toggle ${mode === 'osd' ? 'active' : ''}`}
          onClick={() => handleModeChange(mode === 'osd' ? 'dlna' : 'osd')}
          type="button"
          aria-pressed={mode === 'osd'}
        >
          <ListMusic size={14} />
          <span>{mode === 'osd' ? 'Library' : 'Receiver list'}</span>
        </button>
      </div>

      {/* ── DLNA Mode Layout ── */}
      {mode === 'dlna' ? (
        <>
          <div className="sheet-heading netlist-header">
            {selectedServer && (
              <button
                className="round-button netlist-back-btn"
                onClick={handleDlnaBack}
                title="Go back"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div className="netlist-title-group">
              <h2>{selectedServer ? libraryTitle : 'Choose a media server'}</h2>
            </div>
            <div className="netlist-header-right">
              {selectedServer ? (
                <label className="music-v2-search">
                  <span className="sr-only">Search current music view</span>
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search" type="search" />
                </label>
              ) : null}
              {!selectedServer && (
                <button
                  className={`netlist-nav-btn ${scanning ? 'animate-spin' : ''}`}
                  onClick={scanServers}
                  disabled={scanning}
                  title="Scan network for DLNA servers"
                  aria-label="Scan network for DLNA servers"
                >
                  <RefreshCw size={14} />
                </button>
              )}
              {loadingContent && <Loader2 className="animate-spin text-muted" size={14} />}
            </div>
          </div>

          {selectedServer && folderTitleHistory.length > 1 ? (
            <nav className="music-v2-breadcrumbs" aria-label="Music folder path">
              {folderTitleHistory.slice(0, -1).map((title, index) => (
                <React.Fragment key={`${folderHistory[index]}-${title}`}>
                  {index > 0 ? <span aria-hidden="true">/</span> : null}
                  <button type="button" onClick={() => handleBreadcrumb(index)}>{index === 0 ? selectedServer.friendlyName : title}</button>
                </React.Fragment>
              ))}
            </nav>
          ) : null}

          {libraryError ? (
            <div className="inline-error netlist-local-error" role="alert">
              <span>{libraryError}</span>
              {failedBrowse ? (
                <button
                  type="button"
                  className="netlist-retry-button"
                  aria-label="Retry browse"
                  onClick={() => void browseFolder(failedBrowse.serverId, failedBrowse.objectId)}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="netlist-items-container" ref={listRef}>
            {!selectedServer && (
              <div className="netlist-scroll-area">
                {loadingServers ? (
                  <div className="netlist-empty">
                    <Loader2 className="animate-spin text-muted" size={24} />
                    <p>Discovering servers...</p>
                  </div>
                ) : servers.length === 0 ? (
                  <div className="netlist-empty">
                    <Server size={24} className="text-muted" />
                    <p>No DLNA servers found.</p>
                    <button className="primary-button" onClick={scanServers} style={{ marginTop: '8px' }}>
                      Scan Network
                    </button>
                  </div>
                ) : (
                  servers.map((server) => (
                    <button
                      type="button"
                      key={server.id}
                      className="netlist-item container"
                      onClick={() => handleSelectServer(server)}
                      aria-label={`Open media server ${server.friendlyName}`}
                    >
                      <span className="netlist-item-icon">
                        <Server size={14} />
                      </span>
                      <span className="netlist-item-text">{server.friendlyName}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {selectedServer && (
              <div className="netlist-scroll-area">
                {libraryView !== 'folders' && selectedServer ? (
                  libraryView === 'artists' && folderTitleHistory.length > 2 && playableItems.length === 0 ? (
                    <div className="music-v2-detail music-v2-artists-detail">
                      <div className="music-v2-detail-hero">
                        <span className="music-v2-detail-art"><CatalogArtwork serviceUrl={serviceUrl} serverId={selectedServer.id} objectId={folderHistory[folderHistory.length - 1]} alt={`${currentFolderTitle} artwork`} fallback={<Users size={54} />} /></span>
                        <div>
                          <span className="music-v2-detail-label">Artist</span>
                          <h3>{currentFolderTitle}</h3>
                          <p>{visibleContainers.length} music collections</p>
                        </div>
                      </div>
                      <div className="music-v2-grid music-v2-artist-collections-grid">
                        {visibleContainers.map((container) => (
                          <button key={container.id} type="button" className="music-v2-card music-v2-albums-card" onClick={() => handleSelectFolder(container)}>
                            <span className="music-v2-art"><CatalogArtwork serviceUrl={serviceUrl} serverId={selectedServer.id} objectId={container.id} alt={`${container.title} artwork`} fallback={<Disc3 size={28} />} /></span>
                            <span className="music-v2-card-title">{container.title}</span>
                            {typeof container.childCount === 'number' ? <span className="text-muted">{container.childCount} items</span> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : playableItems.length > 0 ? (
                    <div className={`music-v2-detail music-v2-${libraryView}-detail`}>
                      <div className="music-v2-detail-hero">
                        <span className="music-v2-detail-art"><CatalogArtwork serviceUrl={serviceUrl} serverId={selectedServer.id} objectId={folderHistory[folderHistory.length - 1]} alt={`${currentFolderTitle} artwork`} fallback={libraryView === 'artists' ? <Users size={54} /> : <Disc3 size={54} />} /></span>
                        <div>
                          <span className="music-v2-detail-label">{libraryView === 'artists' ? 'Artist' : 'Album'}</span>
                          <h3>{libraryView === 'artists' ? playableItems[0]?.artist || currentFolderTitle : playableItems[0]?.album || currentFolderTitle}</h3>
                          <p>{[playableItems[0]?.artist, `${playableItems.length} ${playableItems.length === 1 ? 'track' : 'tracks'}`].filter(Boolean).join(' • ')}</p>
                          <button type="button" className="music-v2-detail-play" onClick={() => void playTrack(playableItems[0], playableItems)}><Play size={15} /> Play {libraryView === 'artists' ? 'Artist' : 'Album'}</button>
                        </div>
                      </div>
                      <div className="music-v2-track-list" aria-label={`${currentFolderTitle} tracks`}>
                        {visibleTracks.map((track, index) => (
                          <button key={track.id} type="button" className="music-v2-track-row" onClick={() => void playTrack(track, playableItems)} aria-label={`Play ${track.title}`}>
                            <span className="music-v2-track-number">{index + 1}</span>
                            <span><strong>{track.title}</strong>{libraryView === 'artists' && track.album ? <small>{track.album}</small> : null}</span>
                            <span className="music-v2-track-duration">{formatDlnaDuration(track.duration)}</span>
                            <Play size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                  <div className={`music-v2-grid music-v2-${libraryView}-grid`}>
                    {visibleContainers.map((container) => (
                      <button key={container.id} type="button" className={`music-v2-card music-v2-${libraryView}-card`} onClick={() => handleSelectFolder(container)}>
                        <span className="music-v2-art"><CatalogArtwork serviceUrl={serviceUrl} serverId={selectedServer.id} objectId={container.id} alt={`${container.title} artwork`} fallback={libraryView === 'artists' ? <Users size={28} /> : libraryView === 'genres' && folderHistory.length === 2 ? <Tags size={28} /> : <Disc3 size={28} />} /></span>
                        <span className="music-v2-card-title">{container.title}</span>
                        {typeof container.childCount === 'number' ? <span className="text-muted">{container.childCount} items</span> : null}
                      </button>
                    ))}
                    {visibleContainers.length === 0 ? <div className="netlist-empty"><p>No {libraryView} match your search.</p></div> : null}
                  </div>
                  )
                ) : null}
                {libraryView === 'folders' ? (
                  <>
                {loadingContent && dlnaItems.length === 0 ? (
                  <div className="netlist-empty">
                    <Loader2 className="animate-spin text-muted" size={24} />
                    <p>Retrieving directory list...</p>
                  </div>
                ) : visibleBrowseItems.length === 0 && !libraryError ? (
                  <div className="netlist-empty">
                    <p>{normalizedSearch ? 'No music matches your search.' : 'This folder is empty.'}</p>
                  </div>
                ) : (
                  visibleBrowseItems.map((item) => {
                    const isContainer = item.type === 'container';
                    const isCurrentlyPlaying = item.type === 'item' && playingItemUrl === item.resourceUrl;

                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={`netlist-item ${item.type} ${isCurrentlyPlaying ? 'playing' : ''}`}
                        onClick={() => isContainer ? handleSelectFolder(item) : playTrack(item as DLNAItem)}
                        aria-label={isContainer ? `Open folder ${item.title}` : `Play ${item.title}`}
                      >
                        <span className="netlist-item-icon">
                          {isContainer ? (
                            <Folder size={14} />
                          ) : isCurrentlyPlaying ? (
                            <Loader2 className="animate-spin" size={14} />
                          ) : (
                            <Music size={14} />
                          )}
                        </span>
                        <span className="netlist-item-text-group">
                          <span className="netlist-item-text" style={{ fontWeight: isContainer ? '500' : 'normal' }}>
                            {item.title}
                          </span>
                          {!isContainer && (item.artist || item.album) && (
                            <span className="text-muted" style={{ fontSize: '10px', marginTop: '1px' }}>
                              {[item.artist, item.album].filter(Boolean).join(' • ')}
                            </span>
                          )}
                        </span>
                        {!isContainer && (
                          <span className="netlist-item-add-btn" aria-hidden="true">
                            <Play size={14} />
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
                  </>
                ) : null}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── OSD Mode Layout ── */
        <>
          <div className="sheet-heading netlist-header">
            <button
              className="round-button netlist-back-btn"
              onClick={handleOsdBack}
              title="Go back (Backspace / Left)"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="netlist-title-group">
              <h2>{osdTitle || 'Net/USB Browser'}</h2>
            </div>
            <div className="netlist-header-right">
              <div className="netlist-nav-controls">
                <button
                  className="netlist-nav-btn"
                  onClick={() => void runOsdCommand('/commands/list/action', { action: 'up' })}
                  disabled={osdPending || Boolean(pendingCommand)}
                  aria-label="Move selection up"
                  title="Scroll Up (Arrow Up)"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  className="netlist-nav-btn"
                  onClick={() => void runOsdCommand('/commands/list/action', { action: 'down' })}
                  disabled={osdPending || Boolean(pendingCommand)}
                  aria-label="Move selection down"
                  title="Scroll Down (Arrow Down)"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              {(osdPending || pendingCommand) && <Loader2 className="animate-spin text-muted" size={14} />}
            </div>
          </div>

          {libraryError ? (
            <p className="inline-error netlist-local-error" role="alert">
              {libraryError}
            </p>
          ) : null}

          <div className="netlist-items-container" ref={listRef} onWheel={handleWheel}>
            {osdPending || (osdItems.length === 0 && !osdTitle) ? (
              <div className="netlist-empty">
                <Loader2 className="animate-spin text-muted" size={24} />
                <p>Loading items...</p>
              </div>
            ) : osdItems.length === 0 ? (
              <div className="netlist-empty">
                <ListMusic size={24} className="text-muted" />
                <p>This list is empty.</p>
              </div>
            ) : (
              <div className="netlist-scroll-area">
                {osdItems.map((item) => {
                  const isSelected = item.index === osdCursor;
                  const cleanItemName = item.name.replace(/\.[^/.]+$/, "");
                  const isPlaying =
                    item.type === 'file' &&
                    !!state.nowPlaying.title &&
                    cleanItemName.toLowerCase() === state.nowPlaying.title.toLowerCase();

                  return (
                    <button
                      type="button"
                      key={item.index}
                      className={`netlist-item ${item.type} ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''}`}
                      onClick={() => handleOsdSelectItem(item.index)}
                      aria-label={`${item.type === 'folder' ? 'Open' : 'Play'} ${item.name}`}
                    >
                      <span className="netlist-item-icon">
                        {item.type === 'folder' ? (
                          <Folder size={14} />
                        ) : isPlaying ? (
                          <Play size={14} />
                        ) : (
                          <Music size={14} />
                        )}
                      </span>
                      <span className="netlist-item-text">{item.name}</span>
                      <span className="netlist-item-add-btn" aria-hidden="true">
                        <Plus size={14} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
