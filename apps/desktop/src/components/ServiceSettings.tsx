import { ArrowLeft, ChevronRight, Edit2, Monitor, Moon, Plus, Radio, Search, Sun, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { useServiceManager, ReceiverDevice, ServiceConfig, TestConnectionResult } from '../ui/useServiceManager';
import type { ThemePreference } from '../ui/theme';

type Props = {
  serviceManager: ReturnType<typeof useServiceManager>;
  serviceReachable: boolean;
  error: string | null;
  themePreference: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onBack: () => void;
  onOpenInput: () => void;
};

export function ServiceSettings({
  serviceManager,
  serviceReachable,
  error,
  themePreference,
  onThemeChange,
  onBack,
  onOpenInput,
}: Props) {
  const [draft, setDraft] = useState<ServiceConfig>({ serviceMode: 'local' });
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<ReceiverDevice[]>([]);
  const [testResults, setTestResults] = useState<Record<string, TestConnectionResult>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editingDevice, setEditingDevice] = useState<Partial<ReceiverDevice> | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deviceNameDraft, setDeviceNameDraft] = useState('');
  const [dacNameDraft, setDacNameDraft] = useState('');

  useEffect(() => {
    if (serviceManager.config) setDraft(serviceManager.config);
  }, [serviceManager.config]);

  const activeDevice = draft.devices?.find(device => device.id === draft.activeDeviceId);
  const savedDevices = draft.devices || [];

  useEffect(() => {
    setDeviceNameDraft(activeDevice?.name || draft.deviceName || '');
    setDacNameDraft(draft.digitalToAnalog || '');
  }, [activeDevice?.id, activeDevice?.name, draft.deviceName, draft.digitalToAnalog]);

  function handleSaveReceiverDetails() {
    const name = deviceNameDraft.trim() || 'CR-N775';
    const newDraft = {
      ...draft,
      deviceName: name,
      digitalToAnalog: dacNameDraft.trim() || undefined,
      devices: activeDevice
        ? savedDevices.map(device => device.id === activeDevice.id ? { ...device, name } : device)
        : draft.devices,
    };
    setDraft(newDraft);
    serviceManager.updateConfig(newDraft);
  }

  async function handleScanLAN() {
    setIsScanning(true);
    try {
      const devices = await invoke<ReceiverDevice[]>('discover_onkyo_devices');
      setDiscoveredDevices(devices);
    } catch (scanError) {
      console.error('Scan LAN error:', scanError);
    } finally {
      setIsScanning(false);
    }
  }

  async function handleTestDevice(device: ReceiverDevice) {
    setTestingId(device.id);
    try {
      const result = await invoke<TestConnectionResult>('test_receiver_connection', {
        host: device.host,
        port: device.port,
      });
      setTestResults(previous => ({ ...previous, [device.id]: result }));

      const updatedDevices = draft.devices?.map(savedDevice => savedDevice.id === device.id
        ? { ...savedDevice, lastTestStatus: result.ok ? 'online' : 'offline', lastTestAt: new Date().toISOString() }
        : savedDevice);
      if (updatedDevices) {
        const newDraft = { ...draft, devices: updatedDevices as ReceiverDevice[] };
        setDraft(newDraft);
        if (device.id === draft.activeDeviceId) serviceManager.updateConfig(newDraft);
      }
    } catch (testError) {
      console.error('Test connection error:', testError);
      setTestResults(previous => ({ ...previous, [device.id]: { ok: false, message: 'Command failed' } }));
    } finally {
      setTestingId(null);
    }
  }

  function handleSaveDevice(device: Partial<ReceiverDevice>) {
    let updatedDevices = [...savedDevices];
    let newId = device.id;
    if (!newId) {
      newId = crypto.randomUUID();
      updatedDevices.push({ ...device, id: newId, source: 'manual', port: device.port || 60128 } as ReceiverDevice);
    } else {
      updatedDevices = updatedDevices.map(savedDevice => savedDevice.id === newId
        ? { ...savedDevice, ...device } as ReceiverDevice
        : savedDevice);
    }
    const newDraft = { ...draft, devices: updatedDevices };
    setDraft(newDraft);
    serviceManager.updateConfig(newDraft);
    setEditingDevice(null);
    setShowAddForm(false);
  }

  function handleDeleteDevice(id: string) {
    if (id === draft.activeDeviceId && !confirm('Are you sure you want to delete the active device?')) return;
    const updatedDevices = savedDevices.filter(device => device.id !== id);
    const newDraft = {
      ...draft,
      devices: updatedDevices,
      activeDeviceId: id === draft.activeDeviceId ? undefined : draft.activeDeviceId,
    };
    setDraft(newDraft);
    serviceManager.updateConfig(newDraft);
  }

  function handleUseDevice(id: string) {
    const newDraft = { ...draft, activeDeviceId: id };
    setDraft(newDraft);
    serviceManager.updateConfig(newDraft);
  }

  const savedDeviceName = activeDevice?.name || draft.deviceName || '';
  const receiverDetailsChanged = deviceNameDraft.trim() !== savedDeviceName
    || dacNameDraft.trim() !== (draft.digitalToAnalog || '');

  return (
    <section className="settings-view">
      <header className="settings-page-header">
        <div>
          <button className="settings-back-button" type="button" onClick={onBack}>
            <ArrowLeft size={15} /> Back
          </button>
          <h2>Settings</h2>
        </div>
        <span className={`status-pill ${serviceReachable ? 'connected' : 'offline'}`}>
          <span className="status-dot" />
          {serviceReachable ? 'Service online' : 'Service offline'}
        </span>
      </header>

      <section className={`receiver-settings-card ${serviceReachable ? 'connected' : 'offline'}`} aria-labelledby="receiver-heading">
        <div className="receiver-card-label" id="receiver-heading">Receiver</div>
        <div className="receiver-card-body">
          <div className="receiver-illustration" aria-hidden="true">
            <Radio size={42} strokeWidth={1.6} />
            <span />
          </div>
          <div className="receiver-card-content">
            <div className="receiver-title-row">
              <h3>{activeDevice?.name || draft.deviceName || 'CR-N775'}</h3>
              <span className={`receiver-state ${serviceReachable ? 'connected' : 'offline'}`}>
                {serviceReachable ? 'Connected' : 'Offline'}
              </span>
            </div>
            <div className="receiver-fields">
              <label htmlFor="device-name-input">
                <span>Device name</span>
                <input
                  id="device-name-input"
                  aria-label="Device name"
                  value={deviceNameDraft}
                  placeholder="CR-N775"
                  onChange={event => setDeviceNameDraft(event.target.value)}
                />
              </label>
              <label htmlFor="dac-name-input">
                <span>Digital to Analog</span>
                <input
                  id="dac-name-input"
                  aria-label="Digital to Analog"
                  value={dacNameDraft}
                  placeholder="ESS Sabre 9038PRO"
                  onChange={event => setDacNameDraft(event.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section devices-settings-card" aria-labelledby="devices-heading">
        <div className="section-header">
          <div>
            <h3 id="devices-heading">Devices</h3>
            <p>Choose which receiver O-Control should use.</p>
          </div>
          <div className="actions">
            <button className="primary-button scan-device-button" type="button" onClick={handleScanLAN} disabled={isScanning}>
              <Search size={14} /> {isScanning ? 'Scanning...' : 'Scan LAN'}
            </button>
            <button className="add-device-button" type="button" onClick={() => { setEditingDevice({ port: 60128 }); setShowAddForm(true); }}>
              <Plus size={14} /> Add device
            </button>
          </div>
        </div>

        {(showAddForm || editingDevice) ? (
          <div className="device-form">
            <input aria-label="Receiver name" placeholder="Name (e.g. CR-N775)" value={editingDevice?.name || ''} onChange={event => setEditingDevice(previous => ({ ...previous, name: event.target.value }))} />
            <input aria-label="Receiver host" placeholder="Host (IP or hostname)" value={editingDevice?.host || ''} onChange={event => setEditingDevice(previous => ({ ...previous, host: event.target.value }))} />
            <input aria-label="Receiver port" placeholder="Port (default: 60128)" type="number" value={editingDevice?.port || ''} onChange={event => setEditingDevice(previous => ({ ...previous, port: Number.parseInt(event.target.value, 10) || undefined }))} />
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => { setEditingDevice(null); setShowAddForm(false); }}>Cancel</button>
              <button className="primary-button" type="button" onClick={() => handleSaveDevice(editingDevice as Partial<ReceiverDevice>)}>Save device</button>
            </div>
          </div>
        ) : null}

        <div className="device-list-container">
          {savedDevices.map(device => {
            const isActive = device.id === activeDevice?.id;
            const testResult = testResults[device.id];
            return (
              <div key={device.id} className={`device-card opt-b ${isActive ? 'active' : ''}`}>
                <button type="button" className="device-select-button" aria-label={`Use ${device.name} receiver`} aria-pressed={isActive} onClick={() => !isActive && handleUseDevice(device.id)}>
                  <span className="device-info">
                    <strong className="device-name-mock">{isActive ? <span className="active-dot">●</span> : null}{device.name}</strong>
                    <span>{device.host}:{device.port}</span>
                    {testResult ? <span className={`status ${testResult.ok ? 'ok' : 'error'}`}>{testResult.ok ? `Online (${testResult.latencyMs ?? '?'}ms)` : 'Offline'}</span> : null}
                  </span>
                </button>
                <div className="device-actions">
                  <button type="button" className="ghost-button" onClick={() => handleTestDevice(device)} disabled={testingId === device.id}>{testingId === device.id ? '...' : 'Test'}</button>
                  <button type="button" className="ghost-button icon-btn" aria-label={`Edit ${device.name}`} onClick={() => setEditingDevice(device)}><Edit2 size={14} /></button>
                  <button type="button" className="ghost-button icon-btn danger" aria-label={`Delete ${device.name}`} onClick={() => handleDeleteDevice(device.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
          {savedDevices.length === 0 ? <p className="settings-note device-empty-state">No devices saved.</p> : null}
        </div>

        {discoveredDevices.length > 0 ? (
          <div className="discovered-list">
            <div className="section-header discovered-heading">
              <h3>Discovered devices</h3>
              <button className="ghost-button" type="button" onClick={() => setDiscoveredDevices([])}>Clear</button>
            </div>
            <div className="device-list-container">
              {discoveredDevices.map(device => (
                <div key={`${device.host}:${device.port}`} className="device-card opt-b discovered">
                  <div className="device-info"><strong>{device.name}</strong><span>{device.host}:{device.port}</span></div>
                  <div className="device-actions"><button className="ghost-button" type="button" onClick={() => handleSaveDevice(device)}>Save</button></div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="settings-preferences" aria-labelledby="appearance-heading">
        <div className="preference-row">
          <div>
            <h3 id="appearance-heading">Appearance</h3>
            <p>{themePreference === 'auto' ? 'Follows your macOS appearance.' : `Always use the ${themePreference} theme.`}</p>
          </div>
          <div className="theme-segmented-control" role="group" aria-label="Theme">
            <button type="button" aria-pressed={themePreference === 'auto'} onClick={() => onThemeChange('auto')}><Monitor size={14} /> Auto</button>
            <button type="button" aria-pressed={themePreference === 'light'} onClick={() => onThemeChange('light')}><Sun size={14} /> Light</button>
            <button type="button" aria-pressed={themePreference === 'dark'} onClick={() => onThemeChange('dark')}><Moon size={14} /> Dark</button>
          </div>
        </div>

        <button className="settings-preference-link" type="button" onClick={onOpenInput}>
          <span><strong>Input source</strong><small>CD, Network, USB, Bluetooth, Line, or Tuner</small></span>
          <ChevronRight size={17} />
        </button>
      </section>

      <div className="tip-box">💡 <strong>Network Standby:</strong> Ensure "Network Standby" is enabled on your receiver (Setup → Network → Network Standby → On) to support powering it on from the app.</div>

      <div className="settings-save-row">
        <button className="primary-button settings-save-button" type="button" onClick={handleSaveReceiverDetails} disabled={!receiverDetailsChanged}>Save changes</button>
      </div>

      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
}
