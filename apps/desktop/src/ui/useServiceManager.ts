import { useEffect, useState } from 'react';

export interface ReceiverDevice {
  id: string;
  name: string;
  host: string;
  port: number;
  model?: string;
  macAddress?: string;
  lastSeenAt?: string;
  lastTestAt?: string;
  lastTestStatus?: 'unknown' | 'online' | 'offline';
  source: 'manual' | 'discovered';
}

export interface ServiceConfig {
  serviceMode: 'local' | 'external';
  activeDeviceId?: string;
  devices?: ReceiverDevice[];
  localConfig?: {
    host?: string;
    port?: number;
    mockMode?: boolean;
  };
  externalUrl?: string;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
  model?: string;
}

export interface ServiceStatus {
  mode: 'local' | 'external';
  url: string;
  healthy: boolean;
  error: string | null;
}

export function useServiceManager() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [config, setConfig] = useState<ServiceConfig>({ serviceMode: 'local' });
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    // Determine if we are in Tauri
    const inTauri = (window as any).__TAURI_INTERNALS__ !== undefined;
    setIsTauri(inTauri);

    if (!inTauri) {
      // Fallback for browser preview
      const fallbackUrl = window.localStorage.getItem('o-control.serviceUrl') || 'http://localhost:8787';
      setStatus({ mode: 'external', url: fallbackUrl, healthy: false, error: null });
      return;
    }

    let intervalId: ReturnType<typeof setInterval>;

    async function checkStatus() {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const currentStatus = await invoke<ServiceStatus>('get_service_status');
        setStatus(currentStatus);
        
        const currentConfig = await invoke<ServiceConfig>('get_service_config');
        setConfig(currentConfig);
      } catch (err) {
        console.error('Failed to get service status or config:', err);
      }
    }

    // Check immediately, then periodically
    void checkStatus();
    intervalId = setInterval(checkStatus, 3000);

    return () => clearInterval(intervalId);
  }, []);

  async function updateConfig(newConfig: ServiceConfig) {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('update_service_config', { config: newConfig });
        setConfig(newConfig);
        // Refresh status immediately
        const currentStatus = await invoke<ServiceStatus>('get_service_status');
        setStatus(currentStatus);
      } catch (err) {
        console.error('Failed to update service config:', err);
      }
    } else {
      // Browser fallback
      if (newConfig.serviceMode === 'external' && newConfig.externalUrl) {
        window.localStorage.setItem('o-control.serviceUrl', newConfig.externalUrl);
        setStatus({ mode: 'external', url: newConfig.externalUrl, healthy: false, error: null });
      }
    }
  }

  return { status, config, updateConfig, isTauri };
}
