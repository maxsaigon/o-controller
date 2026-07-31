import { EventEmitter } from 'node:events';
import type { Client as SSDPClientType, SsdpHeaders } from 'node-ssdp';
import type { RemoteInfo } from 'node:dgram';
import pkg from 'node-ssdp';
const SSDPClient = pkg.Client;
import type { DLNAServer } from './types.js';

const CONTENT_DIRECTORY_ST = 'urn:schemas-upnp-org:service:ContentDirectory:1';

/**
 * Parse a device description XML to extract the friendlyName
 * and the ContentDirectory controlURL.
 */
async function parseDeviceDescription(locationUrl: string): Promise<{
  friendlyName: string;
  contentDirectoryUrl: string;
} | null> {
  try {
    const res = await fetch(locationUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const xml = await res.text();

    // Extract friendlyName
    const nameMatch = xml.match(/<friendlyName>([^<]+)<\/friendlyName>/);
    const friendlyName = nameMatch?.[1] ?? 'Unknown Server';

    // Find the ContentDirectory service block and extract its controlURL
    // The XML structure is: <service>...<serviceType>...ContentDirectory...</serviceType>...<controlURL>/path</controlURL>...</service>
    const serviceBlocks = xml.split(/<service>/gi).slice(1);
    let controlPath = '';

    for (const block of serviceBlocks) {
      if (block.includes('ContentDirectory')) {
        const urlMatch = block.match(/<controlURL>([^<]+)<\/controlURL>/i);
        if (urlMatch) {
          controlPath = urlMatch[1];
          break;
        }
      }
    }

    if (!controlPath) return null;

    // Resolve relative controlURL against location base
    const base = new URL(locationUrl);
    const contentDirectoryUrl = new URL(controlPath, `${base.protocol}//${base.host}`).toString();

    return { friendlyName, contentDirectoryUrl };
  } catch {
    return null;
  }
}

export interface DLNADiscoveryOptions {
  /** How often to re-scan (ms). Default: 30000 */
  scanInterval?: number;
}

/**
 * Discovers DLNA/UPnP Media Servers on the local network using SSDP.
 *
 * Usage:
 * ```ts
 * const discovery = new DLNADiscovery();
 * discovery.on('serverFound', (server) => console.log('Found:', server));
 * discovery.start();
 * ```
 */
export class DLNADiscovery extends EventEmitter {
  private servers = new Map<string, DLNAServer>();
  private ssdpClient: SSDPClientType | null = null;
  private scanTimer: ReturnType<typeof setInterval> | undefined;
  private scanInterval: number;
  private started = false;

  constructor(opts?: DLNADiscoveryOptions) {
    super();
    this.scanInterval = opts?.scanInterval ?? 30_000;
  }

  /** Start discovering DLNA servers */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.ssdpClient = new SSDPClient();

    this.ssdpClient.on('response', (headers: SsdpHeaders, _statusCode: number, rinfo: RemoteInfo) => {
      const location = String(headers.LOCATION ?? headers.location ?? '');
      const usn = String(headers.USN ?? headers.usn ?? '');
      void this.handleSSDPResponse(location, usn, rinfo.address);
    });

    // Initial scan
    this.scan();

    // Periodic re-scan
    this.scanTimer = setInterval(() => this.scan(), this.scanInterval);
    if (this.scanTimer && typeof this.scanTimer.unref === 'function') {
      this.scanTimer.unref();
    }
  }

  /** Stop discovery and clean up */
  stop(): void {
    if (!this.started) return;
    this.started = false;

    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = undefined;
    }

    if (this.ssdpClient) {
      this.ssdpClient.stop();
      this.ssdpClient = null;
    }
  }

  /** Trigger an immediate SSDP scan */
  scan(): void {
    if (!this.ssdpClient) return;
    this.ssdpClient.search(CONTENT_DIRECTORY_ST);
  }

  /** Get all currently known servers */
  getServers(): DLNAServer[] {
    return Array.from(this.servers.values());
  }

  /** Get a specific server by ID */
  getServer(id: string): DLNAServer | undefined {
    return this.servers.get(id);
  }

  private async handleSSDPResponse(location: string, usn: string, address: string): Promise<void> {
    if (!location || !usn) return;

    // Already known?
    if (this.servers.has(usn)) return;

    const parsed = await parseDeviceDescription(location);
    if (!parsed) return;

    const server: DLNAServer = {
      id: usn,
      friendlyName: parsed.friendlyName,
      location,
      contentDirectoryUrl: parsed.contentDirectoryUrl,
      host: address,
    };

    this.servers.set(usn, server);
    this.emit('serverFound', server);
  }
}

// ── Receiver AVTransport Discovery ────────────────────────────

/**
 * Probe a receiver host for its UPnP device description and extract
 * the AVTransport service control URL.
 *
 * Tries common Onkyo UPnP description endpoints until one succeeds.
 * Returns the absolute control URL or null if not found.
 */
export async function discoverReceiverAVTransport(
  receiverHost: string,
  signal?: AbortSignal,
): Promise<string | null> {
  // Known Onkyo UPnP description endpoints (discovered via SSDP)
  const descriptionUrls = [
    `http://${receiverHost}:8888/upnp_descriptor_0`,
    `http://${receiverHost}:60128/upnp_descriptor_0`,
    `http://${receiverHost}:80/upnp_descriptor_0`,
    `http://${receiverHost}:8888/description.xml`,
    `http://${receiverHost}:60128/description.xml`,
    `http://${receiverHost}:80/description.xml`,
  ];

  for (const descUrl of descriptionUrls) {
    try {
      const requestSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(3000)])
        : AbortSignal.timeout(3000);
      const res = await fetch(descUrl, { signal: requestSignal });
      if (!res.ok) continue;
      const xml = await res.text();

      // Find the AVTransport service block and extract its controlURL
      const serviceBlocks = xml.split(/<service>/gi).slice(1);
      for (const block of serviceBlocks) {
        if (block.includes('AVTransport')) {
          const urlMatch = block.match(/<controlURL>([^<]+)<\/controlURL>/i);
          if (urlMatch?.[1]) {
            const base = new URL(descUrl);
            return new URL(urlMatch[1], `${base.protocol}//${base.host}`).toString();
          }
        }
      }
    } catch {
      // This endpoint didn't respond, try next
      continue;
    }
  }

  return null;
}
