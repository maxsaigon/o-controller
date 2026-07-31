import { start, stop } from './server.js';

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await stop();
}

process.once('SIGINT', () => {
  void shutdown();
});

process.once('SIGTERM', () => {
  void shutdown();
});

void start().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
