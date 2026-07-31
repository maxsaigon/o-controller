import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createOutputTail(maxBytes = 64 * 1024) {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('Output-tail capacity must be a positive integer');
  }

  let tail = Buffer.alloc(0);
  let totalBytes = 0;

  return {
    append(chunk) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      totalBytes += bytes.length;
      if (bytes.length >= maxBytes) {
        tail = Buffer.from(bytes.subarray(bytes.length - maxBytes));
        return;
      }
      tail = Buffer.concat([tail, bytes]);
      if (tail.length > maxBytes) {
        tail = tail.subarray(tail.length - maxBytes);
      }
    },
    get byteLength() {
      return tail.length;
    },
    text() {
      return tail.toString('utf8');
    },
    diagnostics() {
      const truncatedBytes = totalBytes - tail.length;
      const prefix =
        truncatedBytes > 0 ? `[truncated ${truncatedBytes} bytes]\n` : '';
      return `${prefix}${tail.toString('utf8').trim() || '(none)'}`;
    },
  };
}

async function reservePort() {
  const server = net.createServer();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  if (!port) {
    throw new Error('Could not reserve a smoke-test port');
  }

  return port;
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }

  return new Promise((resolve, reject) => {
    const onExit = (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    };
    const timer = setTimeout(() => {
      child.removeListener('exit', onExit);
      reject(new Error(`Service did not stop within ${timeoutMs}ms`));
    }, timeoutMs);

    child.once('exit', onExit);
  });
}

function assertChildRunning(status) {
  if (status.error) {
    throw new Error(`Service failed to start: ${status.error.message}`);
  }
  if (status.exited) {
    throw new Error(
      `Service exited before the smoke test completed (code=${status.code}, signal=${status.signal})`,
    );
  }
}

async function waitForHealth(url, timeoutMs, status) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    assertChildRunning(status);
    const remainingMs = deadline - Date.now();

    try {
      const response = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(500, remainingMs))),
      });
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`/health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(Math.min(100, Math.max(0, deadline - Date.now())));
  }

  assertChildRunning(status);
  const detail = lastError instanceof Error ? `: ${lastError.message}` : '';
  throw new Error(
    `Service did not become healthy within ${timeoutMs}ms${detail}`,
  );
}

async function waitForVolume(url, expectedVolume, timeoutMs, status) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    assertChildRunning(status);
    const remainingMs = deadline - Date.now();
    const response = await fetch(`${url}/state`, {
      signal: AbortSignal.timeout(Math.max(1, Math.min(500, remainingMs))),
    });
    if (!response.ok) {
      throw new Error(
        `/state returned ${response.status} while confirming volume`,
      );
    }
    const state = await response.json();
    if (state.volume === expectedVolume) {
      return;
    }
    await sleep(Math.min(25, Math.max(0, deadline - Date.now())));
  }

  throw new Error(
    `Volume did not become ${expectedVolume} within ${timeoutMs}ms`,
  );
}

async function terminateChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill('SIGTERM');

  try {
    await waitForExit(child, 1000);
    return;
  } catch {
    // Escalate below.
  }

  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
  }
  await waitForExit(child, 2000);
}

export async function runServiceSmoke() {
  const port = await reservePort();
  const serviceUrl = `http://127.0.0.1:${port}`;
  const output = createOutputTail();
  const status = {
    error: null,
    exited: false,
    code: null,
    signal: null,
  };
  const child = spawn(process.execPath, ['packages/service/dist/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MOCK_MODE: 'true',
      O_CONTROL_PORT: String(port),
      LOG_LEVEL: 'silent',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    output.append(chunk);
  });
  child.stderr.on('data', (chunk) => {
    output.append(chunk);
  });
  child.once('error', (error) => {
    status.error = error;
  });
  child.once('exit', (code, signal) => {
    status.exited = true;
    status.code = code;
    status.signal = signal;
  });

  try {
    const health = await waitForHealth(serviceUrl, 5000, status);
    if (health.status !== 'ok' || health.mockMode !== true) {
      throw new Error(`Unexpected health response: ${JSON.stringify(health)}`);
    }

    assertChildRunning(status);
    const stateResponse = await fetch(`${serviceUrl}/state`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!stateResponse.ok) {
      throw new Error(`/state returned ${stateResponse.status}`);
    }

    assertChildRunning(status);
    const commandResponse = await fetch(`${serviceUrl}/commands/volume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 22 }),
      signal: AbortSignal.timeout(2000),
    });
    const commandText = await commandResponse.text();
    let command;
    try {
      command = JSON.parse(commandText);
    } catch {
      throw new Error(`Volume command returned invalid JSON: ${commandText}`);
    }
    if (!commandResponse.ok || command.success !== true) {
      throw new Error(
        `Volume command failed (status=${commandResponse.status}): ${JSON.stringify(command)}`,
      );
    }

    await waitForVolume(serviceUrl, 22, 1000, status);
    child.kill('SIGTERM');
    const { code, signal } = await waitForExit(child, 3000);
    if (code !== 0) {
      throw new Error(`Service exited with code ${code} (signal=${signal})`);
    }

    console.log('service smoke: PASS');
  } catch (error) {
    let cleanupError = null;
    try {
      await terminateChild(child);
    } catch (terminationError) {
      cleanupError = terminationError;
    }

    const message = error instanceof Error ? error.message : String(error);
    const cleanupDetail =
      cleanupError instanceof Error
        ? `\nCleanup error: ${cleanupError.message}`
        : '';
    throw new Error(
      `${message}${cleanupDetail}\nCaptured service output:\n${output.diagnostics()}`,
      { cause: error },
    );
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  await runServiceSmoke();
}
