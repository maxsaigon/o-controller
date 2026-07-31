import { spawn } from 'node:child_process';

const stages = [
  { name: 'typecheck', command: 'npm', args: ['run', 'typecheck'], timeoutMs: 120_000 },
  { name: 'unit tests', command: 'npm', args: ['test'], timeoutMs: 120_000 },
  {
    name: 'integration tests',
    command: 'npm',
    args: ['run', 'test:integration'],
    timeoutMs: 120_000,
  },
  { name: 'production build', command: 'npm', args: ['run', 'build'], timeoutMs: 180_000 },
  {
    name: 'Tauri Rust check',
    command: 'npm',
    args: ['run', 'check:tauri'],
    timeoutMs: 240_000,
  },
  {
    name: 'built service smoke',
    command: 'npm',
    args: ['run', 'test:smoke'],
    timeoutMs: 30_000,
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function signalStage(child, signal) {
  if (!child.pid) {
    return;
  }

  try {
    if (process.platform === 'win32') {
      child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error;
    }
  }
}

function isStageAlive(child) {
  if (!child.pid) {
    return false;
  }
  if (process.platform === 'win32') {
    return child.exitCode === null && child.signalCode === null;
  }

  try {
    process.kill(-child.pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') {
      return false;
    }
    if (error?.code === 'EPERM') {
      return true;
    }
    throw error;
  }
}

async function waitForStageToStop(child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (isStageAlive(child) && Date.now() < deadline) {
    await sleep(25);
  }

  return !isStageAlive(child);
}

async function terminateTimedOutStage(child) {
  signalStage(child, 'SIGTERM');
  if (await waitForStageToStop(child, 2000)) {
    return;
  }

  signalStage(child, 'SIGKILL');
  if (await waitForStageToStop(child, 2000)) {
    return;
  }

  signalStage(child, 'SIGKILL');
  child.unref();
}

function runStage(stage) {
  return new Promise((resolve, reject) => {
    console.log(`\n==> ${stage.name}`);
    const startedAt = Date.now();

    const child = spawn(stage.command, stage.args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
      detached: process.platform !== 'win32',
    });
    let settled = false;
    let timedOut = false;

    const settle = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };

    const onError = (error) => {
      if (!timedOut) {
        settle(reject, new Error(`${stage.name} failed to start: ${error.message}`, { cause: error }));
      }
    };

    const onExit = (code, signal) => {
      if (timedOut) {
        return;
      }
      if (code === 0) {
        console.log(`<== ${stage.name} PASS (${Date.now() - startedAt}ms)`);
        settle(resolve);
      } else {
        settle(reject, new Error(`${stage.name} failed (code=${code}, signal=${signal})`));
      }
    };

    child.once('error', onError);
    child.once('exit', onExit);

    const timeout = setTimeout(() => {
      timedOut = true;
      void terminateTimedOutStage(child)
        .catch((error) => {
          console.error(`${stage.name} cleanup failed: ${error.message}`);
        })
        .finally(() => {
          settle(reject, new Error(`${stage.name} timed out after ${stage.timeoutMs}ms`));
        });
    }, stage.timeoutMs);
  });
}

try {
  for (const stage of stages) {
    await runStage(stage);
  }
  console.log('\nverify:agent PASS');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
