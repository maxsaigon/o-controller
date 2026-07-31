import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  runAgentMain,
  runStage,
  stageSpawnSpec,
  windowsTaskkillSpec,
} from './verify-agent.mjs';
import { createOutputTail } from './service-smoke.mjs';

const LONG_LIVED_CHILD = 'setInterval(() => {}, 1000)';

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') {
      return false;
    }
    throw error;
  }
}

async function waitForCondition(predicate, timeoutMs, description) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await predicate();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

function fakeChild(pid) {
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  child.signalCode = null;
  child.kill = () => true;
  return child;
}

function emitExit(child, code, signal = null) {
  child.exitCode = code;
  child.signalCode = signal;
  child.emit('exit', code, signal);
}

function windowsStageHarness() {
  const calls = [];
  const leader = fakeChild(4321);
  const taskkill = fakeChild(4322);
  const logs = [];
  const result = runStage(
    {
      name: 'Windows fixture',
      command: 'npm',
      args: ['run', 'typecheck'],
      timeoutMs: 2000,
    },
    {
      platform: 'win32',
      env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
      logger(message) {
        logs.push(message);
      },
      killGraceMs: 500,
      spawnImpl(command, args, options) {
        calls.push({ command, args, options });
        return calls.length === 1 ? leader : taskkill;
      },
    },
  );

  return { calls, leader, taskkill, logs, result };
}

async function readPidWhenReady(pidFile) {
  return waitForCondition(
    async () => {
      try {
        const value = Number(await readFile(pidFile, 'utf8'));
        return Number.isInteger(value) && value > 0 ? value : false;
      } catch (error) {
        if (error?.code === 'ENOENT') {
          return false;
        }
        throw error;
      }
    },
    2000,
    `fixture PID file ${pidFile}`,
  );
}

function fixtureCode(ending) {
  const endingCode = {
    stay: 'setInterval(() => {}, 1000);',
    success: '',
    failure: 'process.exitCode = 7;',
  }[ending];

  return `
    const { spawn } = require('node:child_process');
    const { writeFileSync } = require('node:fs');
    const child = spawn(process.execPath, ['-e', ${JSON.stringify(LONG_LIVED_CHILD)}], {
      stdio: 'ignore',
    });
    writeFileSync(process.argv[1], String(child.pid));
    child.unref();
    ${endingCode}
  `;
}

async function fixture(t, ending, timeoutMs = 5000) {
  const directory = await mkdtemp(path.join(tmpdir(), 'verify-agent-test-'));
  const pidFile = path.join(directory, 'child.pid');
  let leaderPid = null;
  let childPid = null;

  t.after(async () => {
    if (process.platform !== 'win32' && leaderPid) {
      try {
        process.kill(-leaderPid, 'SIGKILL');
      } catch (error) {
        if (error?.code !== 'ESRCH') {
          throw error;
        }
      }
    }
    if (childPid && processIsAlive(childPid)) {
      try {
        process.kill(childPid, 'SIGKILL');
      } catch (error) {
        if (error?.code !== 'ESRCH') {
          throw error;
        }
      }
    }
    await rm(directory, { recursive: true, force: true });
  });

  const stage = {
    name: `fixture ${ending}`,
    command: process.execPath,
    args: ['-e', fixtureCode(ending), pidFile],
    timeoutMs,
  };
  const options = {
    stdio: 'ignore',
    logger: () => {},
    exitGraceMs: 50,
    termGraceMs: 200,
    killGraceMs: 500,
    pollIntervalMs: 10,
    onSpawn(child) {
      leaderPid = child.pid;
    },
  };

  return {
    stage,
    options,
    async childPid() {
      childPid ??= await readPidWhenReady(pidFile);
      return childPid;
    },
  };
}

test(
  'POSIX cancellation terminates a long-running stage process group',
  {
    skip: process.platform === 'win32',
  },
  async (t) => {
    const item = await fixture(t, 'stay');
    const controller = new AbortController();
    const result = assert.rejects(
      runStage(item.stage, { ...item.options, signal: controller.signal }),
      /fixture stay cancelled by SIGTERM/,
    );
    const childPid = await item.childPid();

    controller.abort({ signal: 'SIGTERM' });

    await result;
    await waitForCondition(
      () => !processIsAlive(childPid),
      2000,
      'cancelled fixture descendant to exit',
    );
  },
);

test(
  'runner SIGTERM waits for current stage-tree cleanup and returns 143',
  {
    skip: process.platform === 'win32',
  },
  async (t) => {
    const item = await fixture(t, 'stay');
    const processRef = new EventEmitter();
    const errors = [];
    const result = runAgentMain({
      ...item.options,
      processRef,
      stages: [item.stage],
      errorLogger(message) {
        errors.push(message);
      },
    });
    const childPid = await item.childPid();

    processRef.emit('SIGTERM');

    assert.equal(await result, 143);
    assert.match(errors.join('\n'), /fixture stay cancelled by SIGTERM/);
    await waitForCondition(
      () => !processIsAlive(childPid),
      2000,
      'runner-cancelled fixture descendant to exit',
    );
  },
);

test(
  'a successful leader with a live descendant is cleaned and rejected',
  {
    skip: process.platform === 'win32',
  },
  async (t) => {
    const item = await fixture(t, 'success');
    const result = assert.rejects(
      runStage(item.stage, item.options),
      /fixture success left descendant processes/,
    );
    const childPid = await item.childPid();

    await result;
    await waitForCondition(
      () => !processIsAlive(childPid),
      2000,
      'successful fixture descendant to exit',
    );
  },
);

test(
  'a nonzero stage cleans its surviving descendant before rejecting',
  {
    skip: process.platform === 'win32',
  },
  async (t) => {
    const item = await fixture(t, 'failure');
    const result = assert.rejects(
      runStage(item.stage, item.options),
      /fixture failure failed \(code=7, signal=null\)/,
    );
    const childPid = await item.childPid();

    await result;
    await waitForCondition(
      () => !processIsAlive(childPid),
      2000,
      'failed fixture descendant to exit',
    );
  },
);

test(
  'a timed-out stage cleans its leader and descendant before rejecting',
  {
    skip: process.platform === 'win32',
  },
  async (t) => {
    const item = await fixture(t, 'stay', 100);
    const result = assert.rejects(
      runStage(item.stage, item.options),
      /fixture stay timed out after 100ms/,
    );
    const childPid = await item.childPid();

    await result;
    await waitForCondition(
      () => !processIsAlive(childPid),
      2000,
      'timed-out fixture descendant to exit',
    );
  },
);

test('Windows wraps npm.cmd with the command interpreter and shell false', () => {
  assert.deepEqual(
    stageSpawnSpec({ command: 'npm', args: ['run', 'typecheck'] }, 'win32', {
      ComSpec: 'C:\\Windows\\System32\\cmd.exe',
    }),
    {
      command: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd', 'run', 'typecheck'],
    },
  );
  assert.deepEqual(
    stageSpawnSpec({ command: 'npm', args: ['test'] }, 'win32', {}),
    {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd', 'test'],
    },
  );
  assert.deepEqual(
    stageSpawnSpec({ command: 'npm', args: ['test'] }, 'linux', {}),
    {
      command: 'npm',
      args: ['test'],
    },
  );
  assert.deepEqual(windowsTaskkillSpec(321), {
    command: 'taskkill',
    args: ['/PID', '321', '/T', '/F'],
  });
});

test('Windows leader exit waits for taskkill tree cleanup before passing', async () => {
  const item = windowsStageHarness();
  let settled = false;
  void item.result.finally(() => {
    settled = true;
  });

  assert.deepEqual(item.calls[0], {
    command: 'C:\\Windows\\System32\\cmd.exe',
    args: ['/d', '/s', '/c', 'npm.cmd', 'run', 'typecheck'],
    options: {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
      detached: false,
    },
  });

  emitExit(item.leader, 0);
  await waitForCondition(
    () => item.calls.length === 2,
    500,
    'Windows taskkill spawn',
  );

  assert.deepEqual(item.calls[1], {
    command: 'taskkill',
    args: ['/PID', '4321', '/T', '/F'],
    options: {
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    },
  });
  assert.equal(settled, false);

  emitExit(item.taskkill, 0);
  await item.result;
  assert.match(item.logs.at(-1), /Windows fixture PASS/);
});

test('Windows taskkill not-found is treated as an already-clean tree', async () => {
  const item = windowsStageHarness();
  emitExit(item.leader, 0);
  await waitForCondition(
    () => item.calls.length === 2,
    500,
    'Windows taskkill spawn',
  );

  emitExit(item.taskkill, 128);

  await item.result;
});

test('Windows taskkill failure rejects an otherwise successful stage', async () => {
  const item = windowsStageHarness();
  const failure = assert.rejects(
    item.result,
    /Windows fixture cleanup failed: taskkill failed \(code=1, signal=null\)/,
  );
  emitExit(item.leader, 0);
  await waitForCondition(
    () => item.calls.length === 2,
    500,
    'Windows taskkill spawn',
  );

  emitExit(item.taskkill, 1);

  await failure;
});

test('captured output retains only a bounded tail', () => {
  const output = createOutputTail(8);
  output.append('abcdefghij');

  assert.equal(output.byteLength, 8);
  assert.equal(output.text(), 'cdefghij');
  assert.match(output.diagnostics(), /truncated 2 bytes/);
  assert.match(output.diagnostics(), /cdefghij$/);
});
