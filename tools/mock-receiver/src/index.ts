import { MockReceiver } from './mock-receiver.js';

const port = parseInt(process.env.MOCK_PORT ?? '60128', 10);

const receiver = new MockReceiver({
  port,
  simulateEvents: process.argv.includes('--simulate-events'),
  eventInterval: 3000,
});

receiver.start().then(() => {
  console.log(`Mock Onkyo CR-N775 running on port ${port}`);
  console.log('Press Ctrl+C to stop');
});

process.on('SIGINT', async () => {
  await receiver.stop();
  process.exit(0);
});

export { MockReceiver } from './mock-receiver.js';
