import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPacket,
  parsePackets,
  volumeToHex,
  hexToVolume,
  buildVolumeCommand,
  buildInputCommand,
  COMMANDS,
} from './index.js';
import {
  PWR_ON,
  PWR_OFF,
  MVL_26,
  MVL_00,
  MVL_MAX,
  AMT_ON,
  AMT_OFF,
  SLI_NET,
  SLI_CD,
  NTI_TITLE,
  NAT_ARTIST,
  NAL_ALBUM,
  NST_PLAYING,
  NST_STOPPED,
  NST_PAUSED,
  NTM_TIME,
  NTR_TRACK,
  MULTI_PACKET,
  PARTIAL_HEADER,
  PARTIAL_PAYLOAD,
  GARBAGE_PREFIX,
  EMPTY,
  PWR_ON_EOF,
  fixturePacket,
} from './test-fixtures.js';

// ─── buildPacket ────────────────────────────────────────────

describe('buildPacket', () => {
  it('should produce a valid eISCP packet for PWR01', () => {
    const packet = buildPacket('PWR01');
    // Check magic
    assert.equal(packet.subarray(0, 4).toString('ascii'), 'ISCP');
    // Check header size
    assert.equal(packet.readUInt32BE(4), 16);
    // Check version
    assert.equal(packet.readUInt8(12), 0x01);
    // Check payload contains the command
    const payload = packet.subarray(16).toString('utf-8');
    assert.ok(payload.startsWith('!1PWR01'));
  });

  it('should include CR terminator in payload', () => {
    const packet = buildPacket('MVLQSTN');
    const payload = packet.subarray(16).toString('utf-8');
    assert.ok(payload.endsWith('\r'));
  });

  it('should set correct data size', () => {
    const packet = buildPacket('PWR01');
    const dataSize = packet.readUInt32BE(8);
    const expectedPayload = '!1PWR01\r';
    assert.equal(dataSize, Buffer.byteLength(expectedPayload, 'utf-8'));
  });

  it('should handle long commands', () => {
    const packet = buildPacket('NTIMy Long Song Title With Spaces');
    const dataSize = packet.readUInt32BE(8);
    const payload = packet.subarray(16, 16 + dataSize).toString('utf-8');
    assert.ok(payload.includes('NTIMy Long Song Title With Spaces'));
  });
});

// ─── parsePackets ───────────────────────────────────────────

describe('parsePackets', () => {
  it('should parse a single power-on packet', () => {
    const result = parsePackets(PWR_ON);
    assert.equal(result.packets.length, 1);
    assert.equal(result.packets[0].command, 'PWR');
    assert.equal(result.packets[0].rawPayload, '01');
    assert.equal(result.remaining.length, 0);
  });

  it('should parse a power-off packet', () => {
    const result = parsePackets(PWR_OFF);
    assert.equal(result.packets.length, 1);
    assert.equal(result.packets[0].command, 'PWR');
    assert.equal(result.packets[0].rawPayload, '00');
  });

  it('should parse volume response', () => {
    const result = parsePackets(MVL_26);
    assert.equal(result.packets.length, 1);
    assert.equal(result.packets[0].command, 'MVL');
    assert.equal(result.packets[0].rawPayload, '1A');
  });

  it('should parse volume min', () => {
    const result = parsePackets(MVL_00);
    assert.equal(result.packets[0].rawPayload, '00');
  });

  it('should parse volume max', () => {
    const result = parsePackets(MVL_MAX);
    assert.equal(result.packets[0].rawPayload, '64');
  });

  it('should parse mute on/off', () => {
    assert.equal(parsePackets(AMT_ON).packets[0].rawPayload, '01');
    assert.equal(parsePackets(AMT_OFF).packets[0].rawPayload, '00');
  });

  it('should parse input selector', () => {
    assert.equal(parsePackets(SLI_NET).packets[0].rawPayload, '2B');
    assert.equal(parsePackets(SLI_CD).packets[0].rawPayload, '23');
  });

  it('should parse now-playing metadata', () => {
    const title = parsePackets(NTI_TITLE).packets[0];
    assert.equal(title.command, 'NTI');
    assert.equal(title.rawPayload, 'My Song Title');

    const artist = parsePackets(NAT_ARTIST).packets[0];
    assert.equal(artist.command, 'NAT');
    assert.equal(artist.rawPayload, 'John Coltrane');

    const album = parsePackets(NAL_ALBUM).packets[0];
    assert.equal(album.command, 'NAL');
    assert.equal(album.rawPayload, 'A Love Supreme');
  });

  it('should parse playback status', () => {
    const playing = parsePackets(NST_PLAYING).packets[0];
    assert.equal(playing.command, 'NST');
    assert.equal(playing.rawPayload, 'P--');

    const stopped = parsePackets(NST_STOPPED).packets[0];
    assert.equal(stopped.rawPayload, 'S--');

    const paused = parsePackets(NST_PAUSED).packets[0];
    assert.equal(paused.rawPayload, 'x--');
  });

  it('should parse time info', () => {
    const time = parsePackets(NTM_TIME).packets[0];
    assert.equal(time.command, 'NTM');
    assert.equal(time.rawPayload, '01:23/04:56');
  });

  it('should parse track number', () => {
    const track = parsePackets(NTR_TRACK).packets[0];
    assert.equal(track.command, 'NTR');
    assert.equal(track.rawPayload, '0003/0012');
  });

  // ── Multiple packets ──

  it('should parse multiple concatenated packets', () => {
    const result = parsePackets(MULTI_PACKET);
    assert.equal(result.packets.length, 2);
    assert.equal(result.packets[0].command, 'PWR');
    assert.equal(result.packets[0].rawPayload, '01');
    assert.equal(result.packets[1].command, 'MVL');
    assert.equal(result.packets[1].rawPayload, '1A');
    assert.equal(result.remaining.length, 0);
  });

  // ── Partial packets ──

  it('should return remaining bytes for incomplete header', () => {
    const result = parsePackets(PARTIAL_HEADER);
    assert.equal(result.packets.length, 0);
    assert.equal(result.remaining.length, 16);
  });

  it('should return remaining bytes for incomplete payload', () => {
    const result = parsePackets(PARTIAL_PAYLOAD);
    assert.equal(result.packets.length, 0);
    assert.ok(result.remaining.length > 0);
  });

  // ── Edge cases ──

  it('should handle empty buffer', () => {
    const result = parsePackets(EMPTY);
    assert.equal(result.packets.length, 0);
    assert.equal(result.remaining.length, 0);
  });

  it('should recover from garbage prefix', () => {
    const result = parsePackets(GARBAGE_PREFIX);
    assert.equal(result.packets.length, 1);
    assert.equal(result.packets[0].command, 'PWR');
    assert.equal(result.packets[0].rawPayload, '01');
  });

  it('should parse packets with EOF terminator', () => {
    const result = parsePackets(PWR_ON_EOF);
    assert.equal(result.packets.length, 1);
    assert.equal(result.packets[0].command, 'PWR');
    assert.equal(result.packets[0].rawPayload, '01');
  });

  // ── Roundtrip ──

  it('should roundtrip: build → parse', () => {
    const commands = ['PWR01', 'MVL1A', 'AMT00', 'SLI2B', 'PWRQSTN'];
    for (const cmd of commands) {
      const packet = buildPacket(cmd);
      const result = parsePackets(packet);
      assert.equal(result.packets.length, 1, `Failed roundtrip for ${cmd}`);
      const expectedGroup = cmd.substring(0, 3);
      const expectedPayload = cmd.substring(3);
      assert.equal(result.packets[0].command, expectedGroup);
      assert.equal(result.packets[0].rawPayload, expectedPayload);
    }
  });
});

// ─── Volume Helpers ─────────────────────────────────────────

describe('volumeToHex', () => {
  it('should convert 0 to 00', () => assert.equal(volumeToHex(0), '00'));
  it('should convert 26 to 1A', () => assert.equal(volumeToHex(26), '1A'));
  it('should convert 100 to 64', () => assert.equal(volumeToHex(100), '64'));
  it('should clamp negative values to 00', () => assert.equal(volumeToHex(-5), '00'));
  it('should clamp values above 100 to 64', () => assert.equal(volumeToHex(150), '64'));
  it('should round fractional values', () => assert.equal(volumeToHex(26.7), '1B'));
});

describe('hexToVolume', () => {
  it('should convert 00 to 0', () => assert.equal(hexToVolume('00'), 0));
  it('should convert 1A to 26', () => assert.equal(hexToVolume('1A'), 26));
  it('should convert 64 to 100', () => assert.equal(hexToVolume('64'), 100));
  it('should return 0 for invalid hex', () => assert.equal(hexToVolume('ZZ'), 0));
  it('should handle lowercase hex', () => assert.equal(hexToVolume('1a'), 26));
});

describe('buildVolumeCommand', () => {
  it('should build MVL1A for volume 26', () => {
    assert.equal(buildVolumeCommand(26), 'MVL1A');
  });
  it('should build MVL00 for volume 0', () => {
    assert.equal(buildVolumeCommand(0), 'MVL00');
  });
});

describe('buildInputCommand', () => {
  it('should build SLI2B for NET', () => {
    assert.equal(buildInputCommand('2B'), 'SLI2B');
  });
  it('should build SLI23 for CD', () => {
    assert.equal(buildInputCommand('23'), 'SLI23');
  });
});

describe('COMMANDS constants', () => {
  it('should have power commands', () => {
    assert.equal(COMMANDS.POWER_QUERY, 'PWRQSTN');
    assert.equal(COMMANDS.POWER_ON, 'PWR01');
    assert.equal(COMMANDS.POWER_OFF, 'PWR00');
  });
  it('should have volume commands', () => {
    assert.equal(COMMANDS.VOLUME_QUERY, 'MVLQSTN');
    assert.equal(COMMANDS.VOLUME_UP, 'MVLUP');
    assert.equal(COMMANDS.VOLUME_DOWN, 'MVLDOWN');
  });
});
