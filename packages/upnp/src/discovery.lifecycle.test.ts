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
