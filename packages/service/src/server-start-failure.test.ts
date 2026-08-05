import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.MOCK_MODE = 'true';
process.env.LOG_LEVEL = 'silent';

const { app, receiver, start } = await import('./server.js');

test('post-listen runtime initialization failure closes the listener', async () => {
  const originalListen = app.listen;
  const originalClose = app.close;
  const originalConnect = receiver.connect.bind(receiver);
  const originalListening = Object.getOwnPropertyDescriptor(app.server, 'listening');
  let simulatedListening = false;
  let listenOptions: unknown;

  Object.defineProperty(app.server, 'listening', {
    configurable: true,
    get: () => simulatedListening,
  });
  (app as any).listen = async (options: unknown) => {
    listenOptions = options;
    simulatedListening = true;
    return 'http://127.0.0.1:0';
  };
  (app as any).close = async () => {
    simulatedListening = false;
  };
  receiver.connect = () => {
    throw new Error('receiver startup failed');
  };

  try {
    await assert.rejects(start(), /receiver startup failed/);
    assert.deepEqual(listenOptions, { port: 8787, host: '127.0.0.1' });
    assert.equal(app.server.listening, false);
  } finally {
    (app as any).listen = originalListen;
    (app as any).close = originalClose;
    receiver.connect = originalConnect;
    if (originalListening) {
      Object.defineProperty(app.server, 'listening', originalListening);
    } else {
      delete (app.server as any).listening;
    }
  }
});
