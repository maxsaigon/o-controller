import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { MockReceiver } from '../../tools/mock-receiver/src/mock-receiver.ts';
import { buildPacket, parsePackets, COMMANDS } from '../../packages/eiscp/src/index.ts';

/**
 * Integration tests: Service ↔ Mock Receiver.
 * These test the full TCP communication path.
 */
describe('Integration: eISCP ↔ Mock Receiver', () => {
  let mockReceiver: MockReceiver;
  let mockPort: number;

  before(async () => {
    // Use port 0 to get a random available port
    mockReceiver = new MockReceiver({ port: 0 });
    await mockReceiver.start();
    mockPort = mockReceiver.getPort();
  });

  after(async () => {
    await mockReceiver.stop();
  });

  function connectAndSend(command: string): Promise<{ command: string; rawPayload: string }[]> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const responses: { command: string; rawPayload: string }[] = [];
      let buffer = Buffer.alloc(0);

      socket.connect(mockPort, '127.0.0.1', () => {
        socket.write(buildPacket(command));
      });

      socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        const { packets, remaining } = parsePackets(buffer);
        buffer = remaining;
        responses.push(...packets);

        // Wait a bit for all responses, then close
        setTimeout(() => {
          socket.destroy();
          resolve(responses);
        }, 100);
      });

      socket.on('error', reject);

      // Timeout safety
      setTimeout(() => {
        socket.destroy();
        if (responses.length > 0) resolve(responses);
        else reject(new Error('Timeout waiting for response'));
      }, 2000);
    });
  }

  it('should respond to power query', async () => {
    const responses = await connectAndSend(COMMANDS.POWER_QUERY);
    assert.ok(responses.length > 0);
    assert.equal(responses[0].command, 'PWR');
    assert.equal(responses[0].rawPayload, '01');
  });

  it('should respond to power off', async () => {
    const responses = await connectAndSend(COMMANDS.POWER_OFF);
    assert.ok(responses.length > 0);
    assert.equal(responses[0].command, 'PWR');
    assert.equal(responses[0].rawPayload, '00');
  });

  it('should respond to volume query', async () => {
    const responses = await connectAndSend(COMMANDS.VOLUME_QUERY);
    assert.ok(responses.length > 0);
    assert.equal(responses[0].command, 'MVL');
  });

  it('should respond to volume set', async () => {
    const responses = await connectAndSend('MVL20');
    assert.ok(responses.length > 0);
    assert.equal(responses[0].command, 'MVL');
    assert.equal(responses[0].rawPayload, '20');
  });

  it('should respond to mute query', async () => {
    const responses = await connectAndSend(COMMANDS.MUTE_QUERY);
    assert.ok(responses.length > 0);
    assert.equal(responses[0].command, 'AMT');
  });

  it('should respond to input query', async () => {
    const responses = await connectAndSend(COMMANDS.INPUT_QUERY);
    assert.ok(responses.length > 0);
    assert.equal(responses[0].command, 'SLI');
  });

  it('should respond to title query', async () => {
    const responses = await connectAndSend(COMMANDS.TITLE_QUERY);
    assert.ok(responses.length > 0);
    assert.equal(responses[0].command, 'NTI');
    assert.ok(responses[0].rawPayload.length > 0);
  });

  it('should respond to playback status query', async () => {
    const responses = await connectAndSend(COMMANDS.PLAYBACK_STATUS_QUERY);
    assert.ok(responses.length > 0);
    assert.equal(responses[0].command, 'NST');
  });

  it('should handle play command', async () => {
    const responses = await connectAndSend(COMMANDS.NET_PLAY);
    assert.ok(responses.length > 0);
    assert.equal(responses[0].command, 'NST');
    assert.ok(responses[0].rawPayload.startsWith('P'));
  });

  it('should handle pause command', async () => {
    const responses = await connectAndSend(COMMANDS.NET_PAUSE);
    assert.ok(responses.length > 0);
    assert.equal(responses[0].command, 'NST');
    assert.ok(responses[0].rawPayload.startsWith('x'));
  });

  it('should handle input change', async () => {
    const responses = await connectAndSend('SLI23'); // CD
    assert.ok(responses.length > 0);
    assert.equal(responses[0].command, 'SLI');
    assert.equal(responses[0].rawPayload, '23');
  });
});
