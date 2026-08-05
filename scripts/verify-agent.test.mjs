import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runAgentMain, runStage } from './verify-agent.mjs';
import { createOutputTail } from './service-smoke.mjs';

const LONG_LIVED_CHILD = 'setInterval(() => {}, 1000)';
const INTERNAL_DIST_DIRS = [
  'packages/shared/dist',
  'packages/eiscp/dist',
  'packages/upnp/dist',
];

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function withDirectoriesIsolated(
  directories,
  operation,
  { moveImpl = rename } = {},
) {
  const repositoryRoot = process.cwd();
  const backupParent = path.join(repositoryRoot, 'tmp');
  await mkdir(backupParent, { recursive: true });
  const backupRoot = await mkdtemp(
    path.join(backupParent, 'verify-agent-typecheck-'),
  );

  assert.equal(
    (await stat(backupRoot)).dev,
    (await stat(repositoryRoot)).dev,
    'artifact backup must be on the repository filesystem',
  );

  const states = [];
  for (const [index, entry] of directories.entries()) {
    const directory = path.resolve(entry);
    const existed = await pathExists(directory);
    states.push({
      directory,
      existed,
      originalStat: existed ? await stat(directory) : null,
      backup: path.join(backupRoot, `artifact-${index}`),
      moved: false,
    });
  }

  let operationStarted = false;
  let operationResult;
  let operationError;
  try {
    for (const state of states) {
      if (!state.existed) {
        continue;
      }
      await moveImpl(state.directory, state.backup);
      state.moved = true;
    }
    operationStarted = true;
    operationResult = await operation({ backupRoot, states });
  } catch (error) {
    operationError = error;
  }

  const cleanupErrors = [];
  for (const state of states) {
    try {
      if (state.moved) {
        await rm(state.directory, { recursive: true, force: true });
        await rename(state.backup, state.directory);
      } else if (!state.existed && operationStarted) {
        await rm(state.directory, { recursive: true, force: true });
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length === 0) {
    try {
      await rm(backupRoot, { recursive: true, force: true });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      operationError ? [operationError, ...cleanupErrors] : cleanupErrors,
      'failed to restore isolated artifact directories',
    );
  }
  if (operationError) {
    throw operationError;
  }
  return { operationResult, states };
}

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
    const item = await fixture(t, 'stay', 5000);
    const timerHandle = Symbol('timeout handle');
    let triggerTimeout;
    let clearedHandle;
    const result = assert.rejects(
      runStage(item.stage, {
        ...item.options,
        setTimeoutImpl(callback, delay) {
          assert.equal(delay, 5000);
          triggerTimeout = callback;
          return timerHandle;
        },
        clearTimeoutImpl(handle) {
          clearedHandle = handle;
        },
      }),
      /fixture stay timed out after 5000ms/,
    );
    const childPid = await item.childPid();
    assert.equal(typeof triggerTimeout, 'function');

    triggerTimeout();

    await result;
    assert.equal(clearedHandle, timerHandle);
    await waitForCondition(
      () => !processIsAlive(childPid),
      2000,
      'timed-out fixture descendant to exit',
    );
  },
);

test('Windows verification fails before spawning a stage', async () => {
  let spawnCalls = 0;
  const errors = [];

  const exitCode = await runAgentMain({
    platform: 'win32',
    stages: [
      {
        name: 'must not start',
        command: 'npm',
        args: ['test'],
        timeoutMs: 1000,
      },
    ],
    logger: () => {},
    errorLogger(message) {
      errors.push(message);
    },
    spawnImpl() {
      spawnCalls += 1;
      throw new Error('stage spawn must not be reached');
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(spawnCalls, 0);
  assert.deepEqual(errors, [
    'verify:agent requires POSIX process-group isolation; Windows is not supported',
  ]);
});

test(
  'typecheck bootstraps internal declarations without stale dist artifacts',
  { timeout: 120_000 },
  async () => {
    const { states } = await withDirectoriesIsolated(
      INTERNAL_DIST_DIRS,
      async ({ backupRoot }) => {
        assert.equal(
          (await stat(backupRoot)).dev,
          (await stat(process.cwd())).dev,
          'test backups must share the repository filesystem',
        );

        const result = spawnSync('npm', ['run', 'typecheck'], {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 120_000,
        });
        assert.equal(
          result.status,
          0,
          [result.stdout, result.stderr].filter(Boolean).join('\n'),
        );

        for (const relativeDirectory of INTERNAL_DIST_DIRS) {
          assert.equal(
            await pathExists(path.resolve(relativeDirectory, 'index.d.ts')),
            true,
            `${relativeDirectory} was not bootstrapped`,
          );
        }
      },
    );

    for (const state of states) {
      assert.equal(await pathExists(state.directory), state.existed);
      if (state.existed) {
        assert.equal(
          (await stat(state.directory)).ino,
          state.originalStat.ino,
          `${state.directory} was not restored`,
        );
      }
    }
  },
);

test('artifact isolation restores state after setup and operation failures', async () => {
  const fixtureParent = path.resolve('tmp');
  await mkdir(fixtureParent, { recursive: true });
  const fixtureRoot = await mkdtemp(
    path.join(fixtureParent, 'verify-agent-restore-'),
  );
  const first = path.join(fixtureRoot, 'first');
  const second = path.join(fixtureRoot, 'second');
  const absent = path.join(fixtureRoot, 'absent');
  await mkdir(first);
  await mkdir(second);
  await writeFile(path.join(first, 'marker'), 'first-original');
  await writeFile(path.join(second, 'marker'), 'second-original');

  try {
    let moveCalls = 0;
    await assert.rejects(
      withDirectoriesIsolated(
        [first, second, absent],
        async () => assert.fail('operation must not start'),
        {
          async moveImpl(source, destination) {
            moveCalls += 1;
            if (moveCalls === 2) {
              throw new Error('simulated backup failure');
            }
            await rename(source, destination);
          },
        },
      ),
      /simulated backup failure/,
    );
    assert.equal(
      await readFile(path.join(first, 'marker'), 'utf8'),
      'first-original',
    );
    assert.equal(
      await readFile(path.join(second, 'marker'), 'utf8'),
      'second-original',
    );
    assert.equal(await pathExists(absent), false);

    await assert.rejects(
      withDirectoriesIsolated([first, absent], async () => {
        await mkdir(first);
        await writeFile(path.join(first, 'marker'), 'generated');
        await mkdir(absent);
        throw new Error('simulated operation failure');
      }),
      /simulated operation failure/,
    );
    assert.equal(
      await readFile(path.join(first, 'marker'), 'utf8'),
      'first-original',
    );
    assert.equal(await pathExists(absent), false);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('captured output retains only a bounded tail', () => {
  const output = createOutputTail(8);
  output.append('abcdefghij');

  assert.equal(output.byteLength, 8);
  assert.equal(output.text(), 'cdefghij');
  assert.match(output.diagnostics(), /truncated 2 bytes/);
  assert.match(output.diagnostics(), /cdefghij$/);
});
