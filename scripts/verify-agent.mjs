import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const stages = [
  {
    name: 'typecheck',
    command: 'npm',
    args: ['run', 'typecheck'],
    timeoutMs: 120_000,
  },
  { name: 'unit tests', command: 'npm', args: ['test'], timeoutMs: 120_000 },
  {
    name: 'integration tests',
    command: 'npm',
    args: ['run', 'test:integration'],
    timeoutMs: 120_000,
  },
  {
    name: 'production build',
    command: 'npm',
    args: ['run', 'build'],
    timeoutMs: 180_000,
  },
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

export function resolveStageCommand(command, platform = process.platform) {
  return platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
}

export function windowsTaskkillSpec(pid) {
  return {
    command: 'taskkill',
    args: ['/PID', String(pid), '/T', '/F'],
  };
}

function signalProcessGroup(pid, signal, killImpl) {
  try {
    killImpl(-pid, signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error;
    }
  }
}

function isPosixProcessGroupAlive(pid, killImpl) {
  try {
    killImpl(-pid, 0);
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

function isProcessTreeAlive(child, platform, killImpl) {
  if (!child.pid) {
    return false;
  }
  if (platform === 'win32') {
    return child.exitCode === null && child.signalCode === null;
  }
  return isPosixProcessGroupAlive(child.pid, killImpl);
}

async function waitForProcessTreeToStop(child, options, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (
    isProcessTreeAlive(child, options.platform, options.killImpl) &&
    Date.now() < deadline
  ) {
    await sleep(options.pollIntervalMs);
  }
  return !isProcessTreeAlive(child, options.platform, options.killImpl);
}

function runTaskkill(pid, options) {
  const spec = windowsTaskkillSpec(pid);
  return new Promise((resolve, reject) => {
    const killer = options.spawnImpl(spec.command, spec.args, {
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    });
    let settled = false;
    const settle = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      killer.kill();
      settle(
        reject,
        new Error(`taskkill did not finish within ${options.killGraceMs}ms`),
      );
    }, options.killGraceMs);

    killer.once('error', (error) => {
      settle(
        reject,
        new Error(`taskkill failed to start: ${error.message}`, {
          cause: error,
        }),
      );
    });
    killer.once('exit', (code, signal) => {
      if (code === 0) {
        settle(resolve);
      } else {
        settle(
          reject,
          new Error(`taskkill failed (code=${code}, signal=${signal})`),
        );
      }
    });
  });
}

async function terminateProcessTree(child, options) {
  if (!child.pid) {
    return;
  }

  if (options.platform === 'win32') {
    await runTaskkill(child.pid, options);
    return;
  }

  if (!isProcessTreeAlive(child, options.platform, options.killImpl)) {
    return;
  }

  signalProcessGroup(child.pid, 'SIGTERM', options.killImpl);
  if (await waitForProcessTreeToStop(child, options, options.termGraceMs)) {
    return;
  }

  signalProcessGroup(child.pid, 'SIGKILL', options.killImpl);
  if (await waitForProcessTreeToStop(child, options, options.killGraceMs)) {
    return;
  }

  throw new Error(`process group ${child.pid} remained alive after SIGKILL`);
}

function cancellationSignal(signal) {
  const reason = signal?.reason;
  return reason &&
    typeof reason === 'object' &&
    typeof reason.signal === 'string'
    ? reason.signal
    : 'AbortSignal';
}

function stageOptions(options) {
  return {
    platform: options.platform ?? process.platform,
    spawnImpl: options.spawnImpl ?? spawn,
    killImpl: options.killImpl ?? process.kill.bind(process),
    signal: options.signal,
    stdio: options.stdio ?? 'inherit',
    logger: options.logger ?? console.log,
    onSpawn: options.onSpawn,
    exitGraceMs: options.exitGraceMs ?? 100,
    termGraceMs: options.termGraceMs ?? 2000,
    killGraceMs: options.killGraceMs ?? 2000,
    pollIntervalMs: options.pollIntervalMs ?? 25,
  };
}

export function runStage(stage, suppliedOptions = {}) {
  const options = stageOptions(suppliedOptions);
  options.logger(`\n==> ${stage.name}`);

  if (options.signal?.aborted) {
    return Promise.reject(
      new Error(
        `${stage.name} cancelled by ${cancellationSignal(options.signal)}`,
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = options.spawnImpl(
      resolveStageCommand(stage.command, options.platform),
      stage.args,
      {
        cwd: process.cwd(),
        stdio: options.stdio,
        shell: false,
        detached: options.platform !== 'win32',
      },
    );
    options.onSpawn?.(child);

    let completionStarted = false;
    let timeout = null;

    const complete = (kind, details = {}) => {
      if (completionStarted) {
        return;
      }
      completionStarted = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      options.signal?.removeEventListener('abort', onAbort);

      void (async () => {
        if (kind === 'spawn-error') {
          throw new Error(
            `${stage.name} failed to start: ${details.error.message}`,
            {
              cause: details.error,
            },
          );
        }

        if (kind === 'timeout' || kind === 'cancel') {
          try {
            await terminateProcessTree(child, options);
          } catch (error) {
            throw new Error(`${stage.name} cleanup failed: ${error.message}`, {
              cause: error,
            });
          }

          if (kind === 'timeout') {
            throw new Error(
              `${stage.name} timed out after ${stage.timeoutMs}ms`,
            );
          }
          throw new Error(`${stage.name} cancelled by ${details.signal}`);
        }

        const treeStopped = await waitForProcessTreeToStop(
          child,
          options,
          options.exitGraceMs,
        );
        const leftDescendants = !treeStopped;
        if (leftDescendants) {
          try {
            await terminateProcessTree(child, options);
          } catch (error) {
            throw new Error(`${stage.name} cleanup failed: ${error.message}`, {
              cause: error,
            });
          }
        }

        if (details.code === 0) {
          if (leftDescendants) {
            throw new Error(
              `${stage.name} left descendant processes after exiting`,
            );
          }
          options.logger(
            `<== ${stage.name} PASS (${Date.now() - startedAt}ms)`,
          );
          return;
        }

        const descendantDetail = leftDescendants
          ? ' after cleaning descendant processes'
          : '';
        throw new Error(
          `${stage.name} failed (code=${details.code}, signal=${details.signal})${descendantDetail}`,
        );
      })().then(resolve, reject);
    };

    const onAbort = () => {
      complete('cancel', { signal: cancellationSignal(options.signal) });
    };

    child.once('error', (error) => {
      complete('spawn-error', { error });
    });
    child.once('exit', (code, signal) => {
      complete('exit', { code, signal });
    });
    timeout = setTimeout(() => {
      complete('timeout');
    }, stage.timeoutMs);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) {
      onAbort();
    }
  });
}

export async function runStages(stageList = stages, options = {}) {
  for (const stage of stageList) {
    if (options.signal?.aborted) {
      throw new Error(
        `verification cancelled by ${cancellationSignal(options.signal)}`,
      );
    }
    await runStage(stage, options);
  }
  if (options.signal?.aborted) {
    throw new Error(
      `verification cancelled by ${cancellationSignal(options.signal)}`,
    );
  }
}

export async function runAgentMain(options = {}) {
  const processRef = options.processRef ?? process;
  const logger = options.logger ?? console.log;
  const errorLogger = options.errorLogger ?? console.error;
  const controller = new AbortController();
  let receivedSignal = null;

  const cancel = (signal) => {
    if (receivedSignal) {
      return;
    }
    receivedSignal = signal;
    controller.abort({ signal });
  };
  const onSigint = () => cancel('SIGINT');
  const onSigterm = () => cancel('SIGTERM');

  processRef.on('SIGINT', onSigint);
  processRef.on('SIGTERM', onSigterm);

  try {
    await runStages(options.stages ?? stages, {
      ...options,
      logger,
      signal: controller.signal,
    });
    logger('\nverify:agent PASS');
    return 0;
  } catch (error) {
    errorLogger(error instanceof Error ? error.message : String(error));
    if (receivedSignal === 'SIGINT') {
      return 130;
    }
    if (receivedSignal === 'SIGTERM') {
      return 143;
    }
    return 1;
  } finally {
    processRef.removeListener('SIGINT', onSigint);
    processRef.removeListener('SIGTERM', onSigterm);
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  process.exitCode = await runAgentMain();
}
