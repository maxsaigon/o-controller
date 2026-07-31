import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Folder, Music, Play, Plus, ChevronLeft, ChevronUp, ChevronDown, Loader2, RefreshCw, Server, ListMusic } from 'lucide-react';
import type { OControlState } from '@o-control/shared';

interface NetListProps {
  state: OControlState;
  pendingCommand: string | null;
  command: (path: string, body: unknown, label: string) => Promise<boolean>;
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

export const NetList: React.FC<NetListProps> = ({ state, pendingCommand, command, serviceUrl }) => {
  const isNetOrUsb = state.input === 'net' || state.input === 'usb';
  const { title: osdTitle, items: osdItems, cursor: osdCursor } = state.netList;
  const listRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef<number>(0);

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
  const [dlnaError, setDlnaError] = useState<string | null>(null);
  const [playingItemUrl, setPlayingItemUrl] = useState<string | null>(null);

  // Persistence of mode
  useEffect(() => {
    localStorage.setItem('netlist_mode', mode);
  }, [mode]);

  // Fetch DLNA Servers
  const fetchServers = useCallback(async () => {
    setLoadingServers(true);
    setDlnaError(null);
    try {
      const res = await fetch(`${serviceUrl}/dlna/servers`);
      if (!res.ok) throw new Error('Failed to load media servers');
      const data = await res.json() as { servers: DLNAServer[] };
      setServers(data.servers);
    } catch (err) {
      setDlnaError(err instanceof Error ? err.message : 'Failed to query DLNA servers');
    } finally {
      setLoadingServers(false);
    }
  }, [serviceUrl]);

  // Scan for DLNA Servers
  const scanServers = async () => {
    setScanning(true);
    setDlnaError(null);
    try {
      const res = await fetch(`${serviceUrl}/dlna/scan`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to trigger scan');
      // Wait a moment for SSDP to discover and write to database, then fetch
      setTimeout(() => {
        void fetchServers();
        setScanning(false);
      }, 1500);
    } catch (err) {
      setDlnaError(err instanceof Error ? err.message : 'Scan trigger failed');
      setScanning(false);
    }
  };

  // Browse a DLNA Folder
  const browseFolder = useCallback(async (serverId: string, objectId: string) => {
    setLoadingContent(true);
    setDlnaError(null);
    try {
      const res = await fetch(`${serviceUrl}/dlna/browse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, objectId }),
      });
      if (!res.ok) throw new Error('Failed to browse folder contents');
      const data = await res.json() as { items: DLNABrowseElement[] };
      setDlnaItems(data.items);
    } catch (err) {
      setDlnaError(err instanceof Error ? err.message : 'Folder query failed');
    } finally {
      setLoadingContent(false);
    }
  }, [serviceUrl]);

  // Trigger Play via DLNA AVTransport
  const playTrack = async (item: DLNAItem) => {
    if (!item.resourceUrl) return;
    setPlayingItemUrl(item.resourceUrl);
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
      });
      if (!res.ok) {
        throw new Error('AVTransport play failed. Make sure receiver is on Network input.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not play selected track.');
    } finally {
      setPlayingItemUrl(null);
    }
  };

  // ── DLNA Navigation Actions ──────────────────────────────────
  const handleSelectServer = (server: DLNAServer) => {
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

  // ── OSD Mode Event Handlers ──────────────────────────────────
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (mode !== 'osd' || !isNetOrUsb || osdItems.length === 0) return;

    const now = Date.now();
    if (now - lastScrollTime.current < 120) return;

    if (e.deltaY > 0) {
      lastScrollTime.current = now;
      void command('/commands/list/action', { action: 'down' }, 'Scrolling down');
    } else if (e.deltaY < 0) {
      lastScrollTime.current = now;
      void command('/commands/list/action', { action: 'up' }, 'Scrolling up');
    }
  };

  useEffect(() => {
    if (mode === 'osd' && isNetOrUsb && osdItems.length === 0) {
      void command('/commands/list/query', {}, 'Querying list');
    }
  }, [mode, isNetOrUsb, osdItems.length, command]);

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
        void command('/commands/list/action', { action: 'up' }, 'Scrolling up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        void command('/commands/list/action', { action: 'down' }, 'Scrolling down');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (osdCursor >= 0 && osdCursor < osdItems.length) {
          void command('/commands/list/action', { action: 'enter' }, 'Entering selected item');
        }
      } else if (e.key === 'Backspace' || e.key === 'ArrowLeft') {
        e.preventDefault();
        void command('/commands/list/action', { action: 'back' }, 'Navigating back');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode, isNetOrUsb, osdItems, osdCursor, command]);

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
    void command('/commands/list/action', { action: 'back' }, 'Navigating back');
  };

  const handleOsdSelectItem = (index: number) => {
    void command('/commands/list/action', { action: 'select', index }, `Selecting item ${index + 1}`);
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
          onClick={() => setMode('dlna')}
        >
          <Server size={12} />
          <span>DLNA Browser</span>
        </button>
        <button
          className={`netlist-tab ${mode === 'osd' ? 'active' : ''}`}
          onClick={() => setMode('osd')}
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

          <div className="netlist-items-container" ref={listRef}>
            {dlnaError && (
              <div className="netlist-empty" style={{ color: '#ff4d4d' }}>
                <p>{dlnaError}</p>
                <button className="primary-button" onClick={() => selectedServer ? browseFolder(selectedServer.id, folderHistory[folderHistory.length - 1]) : fetchServers()}>
                  Retry
                </button>
              </div>
            )}

            {!dlnaError && !selectedServer && (
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
                    <div
                      key={server.id}
                      className="netlist-item container"
                      onClick={() => handleSelectServer(server)}
                    >
                      <span className="netlist-item-icon">
                        <Server size={14} />
                      </span>
                      <span className="netlist-item-text">{server.friendlyName}</span>
                      <span className="text-muted" style={{ fontSize: '11px' }}>{server.host}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {!dlnaError && selectedServer && (
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
                      <div
                        key={item.id}
                        className={`netlist-item ${item.type} ${isCurrentlyPlaying ? 'playing' : ''}`}
                        onClick={() => isContainer ? handleSelectFolder(item) : playTrack(item as DLNAItem)}
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
                          <button
                            className="netlist-item-add-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              void playTrack(item as DLNAItem);
                            }}
                            title="Play via AVTransport"
                          >
                            <Play size={14} />
                          </button>
                        )}
                      </div>
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
                  onClick={() => command('/commands/list/action', { action: 'up' }, 'Scrolling up')}
                  title="Scroll Up (Arrow Up)"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  className="netlist-nav-btn"
                  onClick={() => command('/commands/list/action', { action: 'down' }, 'Scrolling down')}
                  title="Scroll Down (Arrow Down)"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              {pendingCommand && <Loader2 className="animate-spin text-muted" size={14} />}
            </div>
          </div>

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
                    <div
                      key={item.index}
                      className={`netlist-item ${item.type} ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''}`}
                      onClick={() => handleOsdSelectItem(item.index)}
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
                      <button
                        className="netlist-item-add-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOsdSelectItem(item.index);
                        }}
                        title="Play/Enter"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
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
