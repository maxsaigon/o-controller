import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Folder, Music, Play, Plus, ChevronLeft, ChevronUp, ChevronDown, Loader2, RefreshCw, Server, ListMusic } from 'lucide-react';
import type { OControlState } from '@o-control/shared';
import type { RawCommandResult } from '../ui/useOControlApi';

interface NetListProps {
  state: OControlState;
  pendingCommand: string | null;
  command: (path: string, body: unknown, label: string) => Promise<boolean>;
  rawCommand: (path: string, body: unknown, signal?: AbortSignal) => Promise<RawCommandResult>;
  serviceUrl: string;
}

interface DLNAServer {
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
}

type DLNABrowseElement = DLNAContainer | DLNAItem;

export const NetList: React.FC<NetListProps> = ({
  state,
  pendingCommand,
  command,
  rawCommand,
  serviceUrl,
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
  const browseController = useRef<AbortController | null>(null);
  const playController = useRef<AbortController | null>(null);

  // ── DLNA State ────────────────────────────────────────────────
  const [mode, setMode] = useState<'dlna' | 'osd'>(() => {
    const saved = localStorage.getItem('netlist_mode');
    return (saved === 'dlna' || saved === 'osd') ? saved : 'dlna';
  });

  const [servers, setServers] = useState<DLNAServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<DLNAServer | null>(null);
  const [dlnaItems, setDlnaItems] = useState<DLNABrowseElement[]>([]);
  const [folderHistory, setFolderHistory] = useState<string[]>(['0']);
  const [folderTitleHistory, setFolderTitleHistory] = useState<string[]>(['Root']);
  const [loadingServers, setLoadingServers] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [playingItemUrl, setPlayingItemUrl] = useState<string | null>(null);
  const [osdPending, setOsdPending] = useState(false);

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
    mounted.current = true;
    cancelRequests();
    setServers([]);
    setSelectedServer(null);
    setDlnaItems([]);
    setFolderHistory(['0']);
    setFolderTitleHistory(['Root']);
    setLoadingServers(false);
    setLoadingContent(false);
    setScanning(false);
    setPlayingItemUrl(null);
    setOsdPending(false);
    setLibraryError(null);

    return () => {
      if (lifecycleGeneration.current === lifecycle) {
        mounted.current = false;
        lifecycleGeneration.current += 1;
        cancelRequests();
      }
    };
  }, [cancelRequests, serviceUrl]);

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
    try {
      const res = await fetch(`${serviceUrl}/dlna/browse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, objectId }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Failed to browse folder contents');
      const data = await res.json() as { items: DLNABrowseElement[] };
      if (isCurrent()) setDlnaItems(data.items);
    } catch (err) {
      if (isCurrent()) {
        setLibraryError(err instanceof Error ? err.message : 'Folder query failed');
      }
    } finally {
      releaseController(controller);
      if (browseController.current === controller) browseController.current = null;
      if (isCurrent()) setLoadingContent(false);
    }
  }, [releaseController, serviceUrl, trackController]);

  // Trigger Play via DLNA AVTransport
  const playTrack = async (item: DLNAItem) => {
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
    try {
      const res = await fetch(`${serviceUrl}/dlna/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceUrl: item.resourceUrl,
          title: item.title,
          artist: item.artist,
          mimeType: item.mimeType,
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
    setLoadingServers(false);
    setScanning(false);
    setSelectedServer(server);
    setFolderHistory(['0']);
    setFolderTitleHistory(['Root']);
    void browseFolder(server.id, '0');
  };

  const handleSelectFolder = (container: DLNAContainer) => {
    const nextHistory = [...folderHistory, container.id];
    const nextTitleHistory = [...folderTitleHistory, container.title];
    setFolderHistory(nextHistory);
    setFolderTitleHistory(nextTitleHistory);
    void browseFolder(selectedServer!.id, container.id);
  };

  const handleDlnaBack = () => {
    if (folderHistory.length > 1) {
      const nextHistory = folderHistory.slice(0, -1);
      const nextTitleHistory = folderTitleHistory.slice(0, -1);
      setFolderHistory(nextHistory);
      setFolderTitleHistory(nextTitleHistory);
      void browseFolder(selectedServer!.id, nextHistory[nextHistory.length - 1]);
    } else {
      cancelRequests();
      setLoadingContent(false);
      setPlayingItemUrl(null);
      setSelectedServer(null);
      setDlnaItems([]);
    }
  };

  // Initial load of servers
  useEffect(() => {
    if (isNetOrUsb && mode === 'dlna') {
      void fetchServers();
    }
  }, [isNetOrUsb, mode, fetchServers]);

  useEffect(() => {
    if (isNetOrUsb) return;
    cancelRequests();
    setLoadingServers(false);
    setLoadingContent(false);
    setScanning(false);
    setPlayingItemUrl(null);
    setOsdPending(false);
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
    setMode(nextMode);
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

  return (
    <div className="sheet-panel netlist-panel">
      {/* ── Tabs Header ── */}
      <div className="netlist-tabs">
        <button
          className={`netlist-tab ${mode === 'dlna' ? 'active' : ''}`}
          onClick={() => handleModeChange('dlna')}
          type="button"
        >
          <Server size={12} />
          <span>DLNA Browser</span>
        </button>
        <button
          className={`netlist-tab ${mode === 'osd' ? 'active' : ''}`}
          onClick={() => handleModeChange('osd')}
          type="button"
        >
          <ListMusic size={12} />
          <span>Onkyo OSD</span>
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
              <h2>{selectedServer ? `${selectedServer.friendlyName} - ${currentFolderTitle}` : 'Media Servers'}</h2>
              <span>
                {selectedServer
                  ? `${dlnaItems.length} items loaded`
                  : `${servers.length} servers discovered`}
              </span>
            </div>
            <div className="netlist-header-right">
              {!selectedServer && (
                <button
                  className={`netlist-nav-btn ${scanning ? 'animate-spin' : ''}`}
                  onClick={scanServers}
                  disabled={scanning}
                  title="Scan network for DLNA servers"
                >
                  <RefreshCw size={14} />
                </button>
              )}
              {loadingContent && <Loader2 className="animate-spin text-muted" size={14} />}
            </div>
          </div>

          {libraryError ? (
            <p className="inline-error netlist-local-error" role="alert">
              {libraryError}
            </p>
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
                      <span className="text-muted" style={{ fontSize: '11px' }}>{server.host}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {selectedServer && (
              <div className="netlist-scroll-area">
                {loadingContent && dlnaItems.length === 0 ? (
                  <div className="netlist-empty">
                    <Loader2 className="animate-spin text-muted" size={24} />
                    <p>Retrieving directory list...</p>
                  </div>
                ) : dlnaItems.length === 0 ? (
                  <div className="netlist-empty">
                    <p>This folder is empty.</p>
                  </div>
                ) : (
                  dlnaItems.map((item) => {
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
                        <div className="netlist-item-text-group" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                          <span className="netlist-item-text" style={{ fontWeight: isContainer ? '500' : 'normal' }}>
                            {item.title}
                          </span>
                          {!isContainer && (item.artist || item.album) && (
                            <span className="text-muted" style={{ fontSize: '10px', marginTop: '1px' }}>
                              {[item.artist, item.album].filter(Boolean).join(' • ')}
                            </span>
                          )}
                        </div>
                        {!isContainer && (
                          <span className="netlist-item-add-btn" aria-hidden="true">
                            <Play size={14} />
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
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
              {state.netList.totalItems > 0 && osdItems.length < state.netList.totalItems ? (
                <span className="netlist-loading-progress" style={{ color: '#45aaff' }}>
                  Loading ({osdItems.length}/{state.netList.totalItems})...
                </span>
              ) : (
                <span>{osdItems.length} items found</span>
              )}
            </div>
            <div className="netlist-header-right">
              <div className="netlist-nav-controls">
                <button
                  className="netlist-nav-btn"
                  onClick={() => void runOsdCommand('/commands/list/action', { action: 'up' })}
                  title="Scroll Up (Arrow Up)"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  className="netlist-nav-btn"
                  onClick={() => void runOsdCommand('/commands/list/action', { action: 'down' })}
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
            {osdItems.length === 0 ? (
              <div className="netlist-empty">
                <Loader2 className="animate-spin text-muted" size={24} />
                <p>Loading items...</p>
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
