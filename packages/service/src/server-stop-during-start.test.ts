import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.MOCK_MODE = 'true';
process.env.LOG_LEVEL = 'silent';

const { app, receiver, start, stop } = await import('./server.js');

test('stop during pending start closes the listener without starting runtime services', async () => {
  const originalListen = app.listen;
  const originalClose = app.close;
  const originalConnect = receiver.connect.bind(receiver);
  const originalListening = Object.getOwnPropertyDescriptor(app.server, 'listening');
  let simulatedListening = false;
  let releaseListen!: () => void;
  const listenGate = new Promise<void>((resolve) => {
    releaseListen = resolve;
  });
  let listenEntered!: () => void;
  const entered = new Promise<void>((resolve) => {
    listenEntered = resolve;
  });
  let connectCalls = 0;

  Object.defineProperty(app.server, 'listening', {
    configurable: true,
    get: () => simulatedListening,
  });
  (app as any).listen = async () => {
    listenEntered();
    await listenGate;
    simulatedListening = true;
    return 'http://127.0.0.1:0';
  };
  (app as any).close = async () => {
    simulatedListening = false;
  };
  receiver.connect = () => {
    connectCalls += 1;
  };

  try {
    const starting = start();
    await entered;
    const stopping = stop();
    releaseListen();

    await Promise.all([starting, stopping]);

    assert.equal(connectCalls, 0);
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
