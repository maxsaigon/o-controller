import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { MockReceiver } from '../../tools/mock-receiver/src/mock-receiver.ts';
import { buildPacket, parsePackets, COMMANDS } from '../../packages/eiscp/src/index.ts';

/**
 * Integration tests for socket disconnect and reconnect scenarios.
 *
 * These verify that:
 *  1. The mock receiver correctly drops client connections on simulateDisconnect().
 *  2. Clients can reconnect after a simulated disconnect.
 *  3. State queries work correctly after reconnection.
 *  4. Multiple sequential connections work independently.
 */
describe('Integration: Disconnect/Reconnect', () => {
  let mockReceiver: MockReceiver;
  let mockPort: number;

  before(async () => {
    mockReceiver = new MockReceiver({ port: 0 });
    await mockReceiver.start();
    mockPort = mockReceiver.getPort();
  });

  after(async () => {
    await mockReceiver.stop();
  });

  /**
   * Connect, send a command, wait for response, then close.
   */
  function connectSendReceive(
    command: string,
    timeoutMs = 2000,
  ): Promise<{ command: string; rawPayload: string }[]> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const responses: { command: string; rawPayload: string }[] = [];
      let buffer = Buffer.alloc(0);
      let resolved = false;

      const done = () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(responses);
        }
      };

      socket.connect(mockPort, '127.0.0.1', () => {
        socket.write(buildPacket(command));
      });

      socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        const { packets, remaining } = parsePackets(buffer);
        buffer = remaining;
        responses.push(...packets);
        // Give a moment for any additional responses, then finish
        setTimeout(done, 80);
      });

      socket.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      socket.on('close', () => {
        // If we haven't resolved yet and have responses, resolve
        if (!resolved && responses.length > 0) {
          resolved = true;
          resolve(responses);
        }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          if (responses.length > 0) resolve(responses);
          else reject(new Error('Timeout'));
        }
      }, timeoutMs);
    });
  }

  /**
   * Create a persistent connection that can detect when it is closed.
   */
  function createPersistentConnection(): Promise<{
    socket: net.Socket;
    closed: Promise<void>;
    send: (cmd: string) => void;
    getResponses: () => { command: string; rawPayload: string }[];
  }> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const responses: { command: string; rawPayload: string }[] = [];
      let buffer = Buffer.alloc(0);
      let resolveClosed: () => void;
      const closed = new Promise<void>((r) => { resolveClosed = r; });

      socket.connect(mockPort, '127.0.0.1', () => {
        resolve({
          socket,
          closed,
          send: (cmd: string) => socket.write(buildPacket(cmd)),
          getResponses: () => [...responses],
        });
      });

      socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        const { packets, remaining } = parsePackets(buffer);
        buffer = remaining;
        responses.push(...packets);
      });

      socket.on('close', () => {
        resolveClosed();
      });

      socket.on('error', () => {
        // Swallow errors during disconnect simulation
      });

      setTimeout(() => reject(new Error('Connection timeout')), 3000);
    });
  }

  // Test: Server-side disconnect kills client connection

  it('should detect when mock receiver kills the connection', async () => {
    const conn = await createPersistentConnection();

    // Verify connection works
    conn.send(COMMANDS.POWER_QUERY);
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(conn.getResponses().length > 0, 'Should have received response before disconnect');

    // Simulate server-side disconnect
    await mockReceiver.simulateDisconnect(200);

    // Wait for close event
    await conn.closed;
    // If we got here, the connection was closed as expected
    assert.ok(true, 'Connection was closed by server');
  });

  // Test: Reconnect after disconnect

  it('should allow reconnection after simulated disconnect', async () => {
    // First connection
    const responses1 = await connectSendReceive(COMMANDS.POWER_QUERY);
    assert.ok(responses1.length > 0);
    assert.equal(responses1[0].command, 'PWR');

    // Simulate disconnect (kills all current connections)
    await mockReceiver.simulateDisconnect(200);

    // Wait for disconnect to settle
    await new Promise((r) => setTimeout(r, 300));

    // Reconnect and query again
    const responses2 = await connectSendReceive(COMMANDS.VOLUME_QUERY);
    assert.ok(responses2.length > 0);
    assert.equal(responses2[0].command, 'MVL');
  });

  // Test: State persists across reconnections

  it('should preserve mock receiver state after disconnect/reconnect', async () => {
    // Set volume to a known value
    const setRes = await connectSendReceive('MVL32'); // volume = 50
    assert.equal(setRes[0].command, 'MVL');
    assert.equal(setRes[0].rawPayload, '32');

    // Simulate disconnect
    await mockReceiver.simulateDisconnect(200);
    await new Promise((r) => setTimeout(r, 300));

    // Reconnect and query volume; should still be 50
    const queryRes = await connectSendReceive(COMMANDS.VOLUME_QUERY);
    assert.equal(queryRes[0].command, 'MVL');
    assert.equal(queryRes[0].rawPayload, '32');
  });

  // Test: Multiple sequential connections

  it('should handle multiple sequential connections', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await connectSendReceive(COMMANDS.POWER_QUERY);
      assert.ok(res.length > 0, `Connection ${i + 1} failed`);
      assert.equal(res[0].command, 'PWR');
    }
  });

  // Test: Commands work immediately after reconnect

  it('should accept commands immediately after reconnect', async () => {
    // Disconnect
    await mockReceiver.simulateDisconnect(100);
    await new Promise((r) => setTimeout(r, 200));

    // Fire multiple commands right after reconnecting
    const powerRes = await connectSendReceive(COMMANDS.POWER_ON);
    assert.equal(powerRes[0].rawPayload, '01');

    const muteRes = await connectSendReceive(COMMANDS.MUTE_ON);
    assert.equal(muteRes[0].command, 'AMT');
    assert.equal(muteRes[0].rawPayload, '01');

    const inputRes = await connectSendReceive('SLI23');
    assert.equal(inputRes[0].command, 'SLI');
    assert.equal(inputRes[0].rawPayload, '23');
  });
});
