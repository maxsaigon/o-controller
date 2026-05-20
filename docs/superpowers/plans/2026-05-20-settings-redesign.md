# Settings Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign and simplify the settings tab in the O-Control desktop application by consolidating the device list, removing advanced dev options, and hiding the keyboard shortcut list.

**Architecture:** 
1. Redesign `ServiceSettings.tsx` to consolidate active and saved devices into a single list, where the active device is highlighted with a blue indicator. Row clicks will toggle activation. Remove Advanced and Shortcuts UI elements.
2. Clean up props in `DesktopShell.tsx`.
3. Update `global.css` to use a clean scrollable flexbox layout for the settings view and implement Option B styling for the device table.

**Tech Stack:** React, Tailwind CSS (Vanilla CSS is used in global.css), Tauri, Lucide React

---

### Task 1: Simplify and Consolidate `ServiceSettings.tsx`

**Files:**
- Modify: [ServiceSettings.tsx](file:///Volumes/Mac Work/Onkyo-C/apps/desktop/src/components/ServiceSettings.tsx)

- [ ] **Step 1: Simplify props and remove unused imports/logic**
  Remove `shortcutStatus` from props. Delete the shortcut filter and native shell missing calculations since they are no longer needed.
  Modify the top of the file as follows:
  ```typescript
  // Replace Props definition
  type Props = {
    serviceManager: ReturnType<typeof useServiceManager>;
    serviceReachable: boolean;
    error: string | null;
    onBack: () => void;
    onTest: () => void;
  };
  ```

- [ ] **Step 2: Update the JSX layout**
  Replace the entire return block of `ServiceSettings` to render the unified devices table, inline forms, and the standby tip box at the bottom.
  Use the following structure for the Devices list:
  ```tsx
  return (
    <section className="settings-view">
      <button className="ghost-button back-button" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="settings-header">
        <h2>Settings</h2>
        <span className={`status-pill ${serviceReachable ? 'connected' : 'offline'}`}>
          <span className="status-dot" />
          {serviceReachable ? 'Service online' : 'Service offline'}
        </span>
      </div>

      <div className="settings-section">
        <div className="section-header">
          <h3>Devices</h3>
          <div className="actions">
            <button className="ghost-button" onClick={handleScanLAN} disabled={isScanning}>
              <Search size={14} /> {isScanning ? 'Scanning...' : 'Scan LAN'}
            </button>
            <button className="ghost-button" onClick={() => setShowAddForm(true)}>
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {(showAddForm || editingDevice) && (
          <div className="device-form">
            <input
              placeholder="Name (e.g. CR-N775)"
              value={editingDevice?.name || ''}
              onChange={e => setEditingDevice(prev => ({ ...prev, name: e.target.value }))}
            />
            <input
              placeholder="Host (IP or hostname)"
              value={editingDevice?.host || ''}
              onChange={e => setEditingDevice(prev => ({ ...prev, host: e.target.value }))}
            />
            <input
              placeholder="Port (default: 60128)"
              type="number"
              value={editingDevice?.port || ''}
              onChange={e => setEditingDevice(prev => ({ ...prev, port: parseInt(e.target.value) || undefined }))}
            />
            <div className="form-actions">
              <button className="ghost-button" onClick={() => { setEditingDevice(null); setShowAddForm(false); }}>Cancel</button>
              <button className="primary-button" onClick={() => handleSaveDevice(editingDevice as Partial<ReceiverDevice>)}>Save</button>
            </div>
          </div>
        )}

        <div className="device-list-container">
          {savedDevices.map(device => {
            const isActive = device.id === activeDevice?.id;
            return (
              <div
                key={device.id}
                className={`device-card opt-b ${isActive ? 'active' : ''}`}
                onClick={() => !isActive && handleUseDevice(device.id)}
              >
                <div className="device-info">
                  <strong className="device-name-mock">
                    {isActive && <span className="active-dot">●</span>}
                    {device.name}
                  </strong>
                  <span>{device.host}:{device.port}</span>
                </div>
                <div className="device-actions" onClick={e => e.stopPropagation()}>
                  <button className="ghost-button mini-btn" onClick={() => handleTestDevice(device)} disabled={testingId === device.id}>
                    {testingId === device.id ? '...' : 'Test'}
                  </button>
                  <button className="ghost-button icon-btn" onClick={() => setEditingDevice(device)}><Edit2 size={14} /></button>
                  <button className="ghost-button icon-btn danger" onClick={() => handleDeleteDevice(device.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
          {savedDevices.length === 0 && (
            <p className="settings-note" style={{ padding: '12px', textAlign: 'center' }}>No devices saved.</p>
          )}
        </div>

        {discoveredDevices.length > 0 && (
          <div className="discovered-list">
            <div className="section-header" style={{ marginTop: '12px' }}>
              <h3>Discovered Devices</h3>
              <div className="actions">
                <button className="ghost-button" onClick={() => setDiscoveredDevices([])}>Clear</button>
              </div>
            </div>
            <div className="device-list-container">
              {discoveredDevices.map((device, idx) => (
                <div key={idx} className="device-card opt-b discovered">
                  <div className="device-info">
                    <strong>{device.name}</strong>
                    <span>{device.host}:{device.port}</span>
                  </div>
                  <div className="device-actions">
                    <button className="ghost-button" onClick={() => handleSaveDevice(device)}>Save</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="tip-box">
        💡 <strong>Network Standby:</strong> Ensure "Network Standby" is enabled on your receiver (Setup → Network → Network Standby → On) to support powering it on from the app.
      </div>

      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add apps/desktop/src/components/ServiceSettings.tsx
  git commit -m "feat: consolidate device list and simplify settings component"
  ```

---

### Task 2: Update App Shell Props Handoff

**Files:**
- Modify: [DesktopShell.tsx](file:///Volumes/Mac Work/Onkyo-C/apps/desktop/src/app-shell/DesktopShell.tsx)

- [ ] **Step 1: Remove `shortcutStatus` prop pass-through**
  In the rendering block of `DesktopShell`, remove the `shortcutStatus` prop from `<ServiceSettings />`.
  Lines 101 - 109:
  ```tsx
          {settingsOpen ? (
            <ServiceSettings
              serviceManager={serviceManager}
              serviceReachable={api.serviceReachable}
              error={serviceManager.status?.error || api.error}
              onBack={() => setSettingsOpen(false)}
              onTest={api.refresh}
            />
          ) : (
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add apps/desktop/src/app-shell/DesktopShell.tsx
  git commit -m "refactor: remove shortcutStatus prop from ServiceSettings in shell"
  ```

---

### Task 3: Redesign Styling in `global.css`

**Files:**
- Modify: [global.css](file:///Volumes/Mac Work/Onkyo-C/apps/desktop/src/styles/global.css)

- [ ] **Step 1: Redesign `.settings-view` and layout structure**
  Change `.settings-view` to use flexbox layout and scroll. Replace lines 527-535 and lines 875-878:
  ```css
  .settings-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px 14px 14px;
    background: rgba(16, 17, 18, 0.42);
  }
  ```

- [ ] **Step 2: Add Option B list styling**
  Add styles for `.device-list-container`, `.device-card.opt-b`, the active dot, and actions.
  ```css
  .device-list-container {
    border: 1px solid rgba(229, 226, 221, 0.08);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    overflow: hidden;
  }
  
  .device-card.opt-b {
    padding: 10px 12px;
    cursor: pointer;
    border-color: transparent;
    background: transparent;
    border-bottom: 1px solid rgba(229, 226, 221, 0.06);
    border-radius: 0;
    margin-bottom: 0;
  }
  
  .device-card.opt-b:last-child {
    border-bottom: none;
  }
  
  .device-card.opt-b:hover {
    background: rgba(255, 255, 255, 0.04);
  }
  
  .device-card.opt-b.active {
    background: rgba(69, 170, 255, 0.05);
  }
  
  .active-dot {
    color: #45aaff;
    margin-right: 6px;
    font-size: 12px;
  }
  
  .tip-box {
    background: rgba(69, 170, 255, 0.04);
    border: 1px solid rgba(69, 170, 255, 0.12);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 11px;
    line-height: 1.4;
    color: #9cd5ff;
    margin-top: auto;
  }
  
  /* Icon buttons on rows */
  .icon-btn {
    background: transparent;
    border: none;
    color: #aaa7a2;
    cursor: pointer;
    padding: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.15s ease;
  }
  
  .icon-btn:hover {
    color: #f0ece6;
    background: rgba(255, 255, 255, 0.08);
  }
  
  .icon-btn.danger:hover {
    color: #ff8d82;
    background: rgba(255, 141, 130, 0.12);
  }
  ```

- [ ] **Step 3: Remove unused settings styles**
  Clean up lines containing `.shortcut-list`, `.advanced-section`, `.checkbox-field` style selectors that are no longer used.

- [ ] **Step 4: Commit**
  ```bash
  git add apps/desktop/src/styles/global.css
  git commit -m "style: apply option B settings tab styling and remove unused styles"
  ```

---

### Task 4: Verification

- [ ] **Step 1: Run the application locally**
  Run: `npm run dev` in `apps/desktop` or using the top-level scripts.
  Ensure it starts without errors.

- [ ] **Step 2: Verify the Settings tab**
  Open settings in the app. Verify:
  - Clean layout, no text overlaps.
  - Active device has the active dot and highlighted background.
  - Clicking other devices triggers activation.
  - Actions (Test, Edit, Delete) work properly.
  - Standby Tip Box appears at the bottom.
