import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Regression coverage for the receiver-startup race: a CR-N775 can expose
 * its UPnP endpoint before AVTransport accepts the first SetAVTransportURI.
 */
process.env.MOCK_MODE = 'false';
process.env.ONKYO_HOST = '127.0.0.1';
process.env.LOG_LEVEL = 'silent';

const originalFetch = globalThis.fetch;
const avTransportCalls: string[] = [];
const descriptorXml = `<?xml version="1.0"?>
<root><serviceList><service>
  <serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
  <controlURL>/Control/AVTransport</controlURL>
</service></serviceList></root>`;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes('upnp_descriptor_0') || url.includes('/description.xml')) {
    return new Response(descriptorXml, { status: 200 });
  }

  if (url.endsWith('/Control/AVTransport')) {
    const action = String(init?.headers instanceof Headers
      ? init.headers.get('SOAPAction')
      : (init?.headers as Record<string, string> | undefined)?.SOAPAction ?? '');
    avTransportCalls.push(action);

    // The first request is the transient boot-time failure we saw on device startup.
    if (avTransportCalls.length === 1) {
      return new Response('<errorCode>701</errorCode>', { status: 503 });
    }
    return new Response('', { status: 200 });
  }

  return originalFetch(input, init);
}) as typeof fetch;

const { app, store, dlnaDiscovery } = await import('./server.js');

before(async () => {
  await app.ready();
  store.setConnected(true);
  store.reduce({ command: 'SLI', rawPayload: '2B' });
});

after(async () => {
  globalThis.fetch = originalFetch;
  dlnaDiscovery.stop();
  await app.close();
});

test('retries transient AVTransport failure while receiver is starting', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/dlna/play',
    payload: {
      resourceUrl: 'http://media.local/track.flac',
      title: 'Startup track',
      mimeType: 'audio/flac',
    },
  });

  assert.equal(response.statusCode, 200, response.payload);
  assert.equal(avTransportCalls.length, 3);
  assert.match(avTransportCalls[0], /SetAVTransportURI/);
  assert.match(avTransportCalls[1], /SetAVTransportURI/);
  assert.match(avTransportCalls[2], /Play/);
});
