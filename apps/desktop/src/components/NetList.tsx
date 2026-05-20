import React, { useEffect, useRef } from 'react';
import { Folder, Music, Play, Plus, ChevronLeft, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import type { OControlState } from '@o-control/shared';

interface NetListProps {
  state: OControlState;
  pendingCommand: string | null;
  command: (path: string, body: unknown, label: string) => Promise<void>;
}

export const NetList: React.FC<NetListProps> = ({ state, pendingCommand, command }) => {
  const isNetOrUsb = state.input === 'net' || state.input === 'usb';
  const { title, items, cursor } = state.netList;
  const listRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef<number>(0);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isNetOrUsb || items.length === 0) return;

    const now = Date.now();
    // Throttle scroll wheel events to at most once per 120ms to avoid flooding the receiver
    if (now - lastScrollTime.current < 120) {
      return;
    }

    if (e.deltaY > 0) {
      lastScrollTime.current = now;
      void command('/commands/list/action', { action: 'down' }, 'Scrolling down');
    } else if (e.deltaY < 0) {
      lastScrollTime.current = now;
      void command('/commands/list/action', { action: 'up' }, 'Scrolling up');
    }
  };

  useEffect(() => {
    if (isNetOrUsb && items.length === 0) {
      void command('/commands/list/query', {}, 'Querying list');
    }
  }, [isNetOrUsb, items.length, command]);

  // Handle local keyboard navigation for NetList
  useEffect(() => {
    if (!isNetOrUsb) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside a form input/textarea
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
        if (cursor >= 0 && cursor < items.length) {
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
  }, [isNetOrUsb, items, cursor, command]);

  // Auto-scroll selected item into view when cursor changes
  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      const selectedEl = listRef.current.querySelector('.netlist-item.selected');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [cursor]);

  const handleSwitchInput = () => {
    void command('/commands/input', { input: 'net' }, 'Switch to Network');
  };

  const handleBack = () => {
    void command('/commands/list/action', { action: 'back' }, 'Navigating back');
  };

  const handleSelectItem = (index: number) => {
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

  return (
    <div className="sheet-panel netlist-panel">
      <div className="sheet-heading netlist-header">
        <button 
          className="round-button netlist-back-btn" 
          onClick={handleBack} 
          title="Go back (Backspace / Left)"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="netlist-title-group">
          <h2>{title || 'Net/USB Browser'}</h2>
          <span>{items.length} items found</span>
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
        {items.length === 0 ? (
          <div className="netlist-empty">
            <Loader2 className="animate-spin text-muted" size={24} />
            <p>Loading items...</p>
          </div>
        ) : (
          <div className="netlist-scroll-area">
            {items.map((item) => {
              const isSelected = item.index === cursor;
              const cleanItemName = item.name.replace(/\.[^/.]+$/, "");
              const isPlaying = 
                item.type === 'file' && 
                !!state.nowPlaying.title && 
                cleanItemName.toLowerCase() === state.nowPlaying.title.toLowerCase();

              return (
                <div
                  key={item.index}
                  className={`netlist-item ${item.type} ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''}`}
                  onClick={() => handleSelectItem(item.index)}
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
                      handleSelectItem(item.index);
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
    </div>
  );
};
