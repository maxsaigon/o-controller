import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Route-level tests for the Fastify service.
 *
 * These exercise every REST endpoint through Fastify's inject() API
 * (no real TCP listener needed). The service runs in MOCK_MODE so
 * no physical receiver is required.
 */

// Set env before importing server
process.env.MOCK_MODE = 'true';
process.env.O_CONTROL_PORT = '9999'; // won't actually listen (using inject)
process.env.LOG_LEVEL = 'silent';

const { app, store } = await import('./server.js');

// Ensure the Fastify instance is ready
before(async () => {
  await app.ready();
});

after(async () => {
  await app.close();
});

// GET /health

describe('GET /health', () => {
  it('should return status ok with mock mode flag', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, 'ok');
    assert.equal(body.mockMode, true);
    assert.equal(typeof body.uptime, 'number');
  });
});

// GET /state

describe('GET /state', () => {
  it('should return full state object', async () => {
    const res = await app.inject({ method: 'GET', url: '/state' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(typeof body.connected, 'boolean');
    assert.ok(['on', 'off', 'unknown'].includes(body.power));
    assert.equal(typeof body.volume, 'number');
    assert.equal(typeof body.muted, 'boolean');
    assert.ok(body.nowPlaying !== undefined);
  });
});

// GET /presets

describe('GET /presets', () => {
  it('should return array of presets', async () => {
    const res = await app.inject({ method: 'GET', url: '/presets' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
    assert.ok(body.length >= 3);
    // Verify preset shape
    const first = body[0];
    assert.equal(typeof first.id, 'string');
    assert.equal(typeof first.name, 'string');
    assert.ok(Array.isArray(first.steps));
  });
});

// POST /commands/power

describe('POST /commands/power', () => {
  it('should accept toggle action', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/power',
      payload: { action: 'toggle' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.command.startsWith('PWR'));
  });

  it('should accept explicit on', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/power',
      payload: { action: 'on' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.command, 'PWR01');
  });

  it('should accept explicit off', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/power',
      payload: { action: 'off' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.command, 'PWR00');
  });

  it('should default to toggle when no body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/power',
    });
    assert.equal(res.statusCode, 200);
  });
});

// POST /commands/volume

describe('POST /commands/volume', () => {
  it('should accept volume up', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/volume',
      payload: { value: 'up' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.command, 'MVLUP');
  });

  it('should accept volume down', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/volume',
      payload: { value: 'down' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.command, 'MVLDOWN');
  });

  it('should accept numeric volume', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/volume',
      payload: { value: 42 },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.command, 'MVL2A');
  });

  it('should reject volume out of range', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/volume',
      payload: { value: 150 },
    });
    assert.equal(res.statusCode, 500); // Zod throws, caught by error handler
  });

  it('should reject missing body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/volume',
    });
    assert.ok(res.statusCode >= 400);
  });
});

// POST /commands/mute

describe('POST /commands/mute', () => {
  it('should accept toggle', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/mute',
      payload: { action: 'toggle' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.command.startsWith('AMT'));
  });

  it('should accept explicit on', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/mute',
      payload: { action: 'on' },
    });
    const body = JSON.parse(res.payload);
    assert.equal(body.command, 'AMT01');
  });

  it('should accept explicit off', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/mute',
      payload: { action: 'off' },
    });
    const body = JSON.parse(res.payload);
    assert.equal(body.command, 'AMT00');
  });
});

// POST /commands/input

describe('POST /commands/input', () => {
  it('should accept valid input name', async () => {
    const inputs = ['cd', 'net', 'usb', 'bluetooth', 'line', 'tuner'];
    for (const input of inputs) {
      const res = await app.inject({
        method: 'POST',
        url: '/commands/input',
        payload: { input },
      });
      assert.equal(res.statusCode, 200, `Failed for input: ${input}`);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, true);
      assert.ok(body.command.startsWith('SLI'));
    }
  });

  it('should reject invalid input name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/input',
      payload: { input: 'hdmi' },
    });
    assert.ok(res.statusCode >= 400);
  });
});

// POST /commands/playback

describe('POST /commands/playback', () => {
  it('should accept all playback actions', async () => {
    const actions = ['play', 'pause', 'stop', 'next', 'previous'];
    for (const action of actions) {
      const res = await app.inject({
        method: 'POST',
        url: '/commands/playback',
        payload: { action },
      });
      assert.equal(res.statusCode, 200, `Failed for action: ${action}`);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, true);
    }
  });

  it('should reject invalid action', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/playback',
      payload: { action: 'rewind' },
    });
    assert.ok(res.statusCode >= 400);
  });
});

// POST /presets/:id/run

describe('POST /presets/:id/run', () => {
  it('should run existing preset', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/presets/work-jazz/run',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.presetId, 'work-jazz');
  });

  it('should run focus-quiet preset', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/presets/focus-quiet/run',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
  });

  it('should run stop preset', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/presets/stop/run',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
  });

  it('should return 404 for unknown preset', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/presets/nonexistent/run',
    });
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
  });
});

// GET /cover-art

describe('GET /cover-art', () => {
  beforeEach(async () => {
    store.resetNowPlaying();
    const { setCachedCoverArt } = await import('./server.js');
    setCachedCoverArt(null);
  });

  it('should return mock JPEG in Mock Mode if a title is present', async () => {
    const { MOCK_JPEG } = await import('./server.js');
    store.reduce({ command: 'NTI', rawPayload: 'Mock Title' });
    const res = await app.inject({ method: 'GET', url: '/cover-art' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'image/jpeg');
    assert.deepEqual(res.rawPayload, MOCK_JPEG);
  });

  it('should return 404 in Mock Mode if no title is present', async () => {
    const res = await app.inject({ method: 'GET', url: '/cover-art' });
    assert.equal(res.statusCode, 404);
  });

  it('should redirect to http URL if coverArtUrl is a web URL', async () => {
    store.setCoverArt('https://example.com/album.jpg');
    const res = await app.inject({ method: 'GET', url: '/cover-art' });
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, 'https://example.com/album.jpg');
  });

  it('should return decoded binary buffer if coverArtUrl is base64 data URI', async () => {
    const pngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    store.setCoverArt(pngBase64);

    const res = await app.inject({ method: 'GET', url: '/cover-art' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'image/png');
    const expectedBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    assert.deepEqual(res.rawPayload, expectedBuffer);
  });
});

// 404 for unknown routes

describe('Unknown routes', () => {
  it('should return 404 for undefined routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/nonexistent' });
    assert.equal(res.statusCode, 404);
  });
});

describe('POST /commands/list/action', () => {
  it('should accept list navigation actions', async () => {
    const actions = ['up', 'down', 'enter', 'back'];
    for (const action of actions) {
      const res = await app.inject({
        method: 'POST',
        url: '/commands/list/action',
        payload: { action },
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, true);
    }
  });

  it('should accept select action with index', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/commands/list/action',
      payload: { action: 'select', index: 3 },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.command, 'NLSI00004');
  });
});

describe('POST /commands/list/query', () => {
  it('should reject when input is not net or usb', async () => {
    store.reduce({ command: 'SLI', rawPayload: '23' }); // CD input
    const res = await app.inject({
      method: 'POST',
      url: '/commands/list/query',
    });
    assert.equal(res.statusCode, 400);
  });

  it('should accept when input is net', async () => {
    store.reduce({ command: 'SLI', rawPayload: '2B' }); // NET input
    const res = await app.inject({
      method: 'POST',
      url: '/commands/list/query',
      payload: { type: 'both' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.deepEqual(body.queries, ['NLTQSTN', 'NLSQSTN']);
  });
});

describe('stripOnkyoHeaders', () => {
  it('should strip headers by identifying JPEG magic bytes (FF D8)', async () => {
    const { stripOnkyoHeaders } = await import('./server.js');
    const input = Buffer.concat([
      Buffer.from('Header 1\nHeader 2\nHeader 3\nGarbageBytes'),
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]) // JPEG headers
    ]);
    const result = stripOnkyoHeaders(input);
    assert.deepEqual(result, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]));
  });

  it('should strip headers by finding the 3rd newline when no magic signature matches', async () => {
    const { stripOnkyoHeaders } = await import('./server.js');
    const input = Buffer.from('Line1\nLine2\nLine3\nCleanPayloadHere');
    const result = stripOnkyoHeaders(input);
    assert.equal(result.toString(), 'CleanPayloadHere');
  });

  it('should return raw buffer if fewer than 3 newlines exist and no magic signature matches', async () => {
    const { stripOnkyoHeaders } = await import('./server.js');
    const input = Buffer.from('NoNewlinesHere');
    const result = stripOnkyoHeaders(input);
    assert.equal(result.toString(), 'NoNewlinesHere');
  });
});
