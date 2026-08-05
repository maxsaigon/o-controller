import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DLNADiscovery } from './discovery.js';

test('stopping during a delayed description fetch prevents server discovery', async () => {
  const originalFetch = globalThis.fetch;
  const discovery = new DLNADiscovery();
  let resolveFetch!: (response: Response) => void;
  let requestSignal: AbortSignal | undefined;
  let emitted = 0;

  globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => {
    requestSignal = init?.signal ?? undefined;
    return new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
  }) as typeof fetch;
  discovery.on('serverFound', () => {
    emitted += 1;
  });
  const lifecycleController = new AbortController();
  (discovery as any).started = true;
  (discovery as any).lifecycleController = lifecycleController;

  try {
    const pending = (discovery as any).handleSSDPResponse(
      'http://192.0.2.10/description.xml',
      'uuid:test-server',
      '192.0.2.10',
      lifecycleController.signal,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));

    discovery.stop();
    const wasAborted = requestSignal?.aborted;
    resolveFetch(new Response(`
      <root>
        <device>
          <friendlyName>Delayed Server</friendlyName>
          <serviceList>
            <service>
              <serviceType>urn:schemas-upnp-org:service:ContentDirectory:1</serviceType>
              <controlURL>/content</controlURL>
            </service>
          </serviceList>
        </device>
      </root>
    `));
    await pending;

    assert.equal(wasAborted, true);
    assert.equal(discovery.getServers().length, 0);
    assert.equal(emitted, 0);
  } finally {
    globalThis.fetch = originalFetch;
    discovery.stop();
  }
});

test('scan observes a rejected SSDP startup promise', async () => {
  const discovery = new DLNADiscovery();
  let rejectionObserved = false;
  const rejectedStartup = {
    then(_resolve: () => void, reject: (error: Error) => void) {
      rejectionObserved = true;
      reject(new Error('SSDP startup failed'));
    },
  };

  (discovery as any).ssdpClient = {
    search: () => rejectedStartup,
  };

  discovery.scan();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(rejectionObserved, true);
});

test('late responses from a stopped client cannot enter a new lifecycle', async () => {
  const originalFetch = globalThis.fetch;
  const discovery = new DLNADiscovery();
  const originalScan = discovery.scan;
  let fetchCalls = 0;
  let emitted = 0;

  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(`
      <root>
        <device>
          <friendlyName>Lifecycle Server</friendlyName>
          <serviceList>
            <service>
              <serviceType>urn:schemas-upnp-org:service:ContentDirectory:1</serviceType>
              <controlURL>/content</controlURL>
            </service>
          </serviceList>
        </device>
      </root>
    `);
  }) as typeof fetch;
  discovery.scan = () => {};
  discovery.on('serverFound', () => {
    emitted += 1;
  });

  try {
    discovery.start();
    const oldClient = (discovery as any).ssdpClient;
    discovery.stop();

    discovery.start();
    const currentClient = (discovery as any).ssdpClient;
    const response = {
      LOCATION: 'http://192.0.2.20/description.xml',
      USN: 'uuid:lifecycle-server',
    };
    const remote = { address: '192.0.2.20' };

    oldClient.emit('response', response, 200, remote);
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.deepEqual(
      { fetchCalls, servers: discovery.getServers().length, emitted },
      { fetchCalls: 0, servers: 0, emitted: 0 },
    );

    currentClient.emit('response', response, 200, remote);
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.deepEqual(
      { fetchCalls, servers: discovery.getServers().length, emitted },
      { fetchCalls: 1, servers: 1, emitted: 1 },
    );
  } finally {
    globalThis.fetch = originalFetch;
    discovery.scan = originalScan;
    discovery.stop();
  }
});
