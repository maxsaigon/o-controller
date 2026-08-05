import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.MOCK_MODE = 'true';
process.env.LOG_LEVEL = 'silent';

test('signal shutdown failures are reported with a nonzero exit code', async () => {
  const serverModule = await import('./server.js');
  const { app, receiver } = serverModule;
  const originalListen = app.listen;
  const originalClose = app.close;
  const originalConnect = receiver.connect;
  const originalListening = Object.getOwnPropertyDescriptor(app.server, 'listening');
  const originalConsoleError = console.error;
  const originalExitCode = process.exitCode;
  const existingHandlers = new Set(process.listeners('SIGINT'));
  const existingTermHandlers = new Set(process.listeners('SIGTERM'));
  let logged: unknown[] = [];
  let listening!: () => void;
  const didListen = new Promise<void>((resolve) => {
    listening = resolve;
  });
  let simulatedListening = false;

  Object.defineProperty(app.server, 'listening', {
    configurable: true,
    get: () => simulatedListening,
  });
  (app as any).listen = async () => {
    simulatedListening = true;
    listening();
    return 'http://127.0.0.1:0';
  };
  (app as any).close = async () => {
    throw new Error('shutdown failed');
  };
  receiver.connect = () => {};
  console.error = (...args: unknown[]) => {
    logged = args;
  };

  try {
    await import('./index.js');
    await didListen;

    const signalHandler = process.listeners('SIGINT').find((handler) => !existingHandlers.has(handler));
    assert.ok(signalHandler);
    signalHandler('SIGINT');
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(process.exitCode, 1);
    assert.match(String(logged[0]), /shutdown failed/);
  } finally {
    (app as any).listen = originalListen;
    (app as any).close = originalClose;
    receiver.connect = originalConnect;
    console.error = originalConsoleError;
    process.exitCode = originalExitCode;
    await originalClose();
    for (const handler of process.listeners('SIGINT')) {
      if (!existingHandlers.has(handler)) {
        process.removeListener('SIGINT', handler);
      }
    }
    for (const handler of process.listeners('SIGTERM')) {
      if (!existingTermHandlers.has(handler)) {
        process.removeListener('SIGTERM', handler);
      }
    }
    if (originalListening) {
      Object.defineProperty(app.server, 'listening', originalListening);
    } else {
      delete (app.server as any).listening;
    }
  }
});
