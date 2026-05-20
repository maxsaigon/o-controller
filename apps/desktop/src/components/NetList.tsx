import React, { useEffect } from 'react';
import { Folder, Music, ChevronLeft, Loader2 } from 'lucide-react';
import type { OControlState } from '@o-control/shared';

interface NetListProps {
  state: OControlState;
  pendingCommand: string | null;
  command: (path: string, body: unknown, label: string) => Promise<void>;
}

export const NetList: React.FC<NetListProps> = ({ state, pendingCommand, command }) => {
  const isNetOrUsb = state.input === 'net' || state.input === 'usb';
  const { title, items, cursor } = state.netList;

  useEffect(() => {
    if (isNetOrUsb && items.length === 0) {
      void command('/commands/list/query', {}, 'Querying list');
    }
  }, [isNetOrUsb, items.length, command]);

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
          title="Go back"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="netlist-title-group">
          <h2>{title || 'Net/USB Browser'}</h2>
          <span>{items.length} items found</span>
        </div>
        {pendingCommand && <Loader2 className="animate-spin text-muted" size={14} />}
      </div>

      <div className="netlist-items-container">
        {items.length === 0 ? (
          <div className="netlist-empty">
            <Loader2 className="animate-spin text-muted" size={24} />
            <p>Loading items...</p>
          </div>
        ) : (
          <div className="netlist-scroll-area">
            {items.map((item) => {
              const isSelected = item.index === cursor;
              return (
                <div
                  key={item.index}
                  className={`netlist-item ${item.type} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectItem(item.index)}
                >
                  <span className="netlist-item-icon">
                    {item.type === 'folder' ? (
                      <Folder size={14} />
                    ) : (
                      <Music size={14} />
                    )}
                  </span>
                  <span className="netlist-item-text">{item.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
