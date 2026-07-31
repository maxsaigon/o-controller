import { start, stop } from './server.js';

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await stop();
}

function handleShutdown(): void {
  void shutdown().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

process.once('SIGINT', () => {
  handleShutdown();
});

process.once('SIGTERM', () => {
  handleShutdown();
});

void start().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
