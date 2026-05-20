import { ArrowLeft, RotateCw, Plus, Search, CheckCircle, XCircle, Trash2, Edit2, Play } from 'lucide-react';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { useServiceManager, ServiceConfig, ReceiverDevice, TestConnectionResult } from '../ui/useServiceManager';

type Props = {
  serviceManager: ReturnType<typeof useServiceManager>;
  serviceReachable: boolean;
  error: string | null;
  onBack: () => void;
  onTest: () => void;
};

export function ServiceSettings({ serviceManager, serviceReachable, error, onBack, onTest }: Props) {
  const [draft, setDraft] = useState<ServiceConfig>({ serviceMode: 'local' });
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<ReceiverDevice[]>([]);
  const [testResults, setTestResults] = useState<Record<string, TestConnectionResult>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const [editingDevice, setEditingDevice] = useState<Partial<ReceiverDevice> | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (serviceManager.config) {
      setDraft(serviceManager.config);
    }
  }, [serviceManager.config]);

  const activeDevice = draft.devices?.find(d => d.id === draft.activeDeviceId);
  const savedDevices = draft.devices || [];

  async function handleScanLAN() {
    setIsScanning(true);
    try {
      const devices = await invoke<ReceiverDevice[]>('discover_onkyo_devices');
      setDiscoveredDevices(devices);
    } catch (err) {
      console.error('Scan LAN error:', err);
    } finally {
      setIsScanning(false);
    }
  }

  async function handleTestDevice(device: ReceiverDevice) {
    setTestingId(device.id);
    try {
      const res = await invoke<TestConnectionResult>('test_receiver_connection', { host: device.host, port: device.port });
      setTestResults(prev => ({ ...prev, [device.id]: res }));

      const updatedDevices = draft.devices?.map(d => {
        if (d.id === device.id) {
          return { ...d, lastTestStatus: res.ok ? 'online' : 'offline', lastTestAt: new Date().toISOString() };
        }
        return d;
      });
      if (updatedDevices) {
        const newDraft = { ...draft, devices: updatedDevices as ReceiverDevice[] };
        setDraft(newDraft);
        if (device.id === draft.activeDeviceId) {
          serviceManager.updateConfig(newDraft);
        }
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setTestResults(prev => ({ ...prev, [device.id]: { ok: false, message: 'Command failed' } }));
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
      updatedDevices = updatedDevices.map(d => d.id === newId ? { ...d, ...device } as ReceiverDevice : d);
    }
    const newDraft = { ...draft, devices: updatedDevices };
    setDraft(newDraft);
    serviceManager.updateConfig(newDraft);
    setEditingDevice(null);
    setShowAddForm(false);
  }

  function handleDeleteDevice(id: string) {
    if (id === draft.activeDeviceId) {
      if (!confirm('Are you sure you want to delete the active device?')) return;
    }
    const updatedDevices = savedDevices.filter(d => d.id !== id);
    const newDraft = { ...draft, devices: updatedDevices, activeDeviceId: id === draft.activeDeviceId ? undefined : draft.activeDeviceId };
    setDraft(newDraft);
    serviceManager.updateConfig(newDraft);
  }

  function handleUseDevice(id: string) {
    const newDraft = { ...draft, activeDeviceId: id };
    setDraft(newDraft);
    serviceManager.updateConfig(newDraft);
  }

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
                  {testResults[device.id] && (
                    <span className={`status ${testResults[device.id].ok ? 'ok' : 'error'}`} style={{ fontSize: '10px', marginTop: '2px' }}>
                      {testResults[device.id].ok ? `Online (${testResults[device.id].latencyMs ?? '?'}ms)` : 'Offline'}
                    </span>
                  )}
                </div>
                <div className="device-actions" onClick={e => e.stopPropagation()}>
                  <button className="ghost-button" onClick={() => handleTestDevice(device)} disabled={testingId === device.id}>
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
}
