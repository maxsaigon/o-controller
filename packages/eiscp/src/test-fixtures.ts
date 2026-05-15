/**
 * Test fixtures for eISCP packet builder/parser.
 * These represent real-world eISCP packets and edge cases.
 */

/**
 * Build a raw eISCP packet buffer from a command string.
 * This is a manual implementation for creating test fixtures.
 */
export function fixturePacket(command: string): Buffer {
  const iscpMessage = `!1${command}\r`;
  const messageBytes = Buffer.from(iscpMessage, 'utf-8');

  const header = Buffer.alloc(16);
  Buffer.from('ISCP').copy(header, 0);
  header.writeUInt32BE(16, 4);
  header.writeUInt32BE(messageBytes.length, 8);
  header.writeUInt8(0x01, 12);

  return Buffer.concat([header, messageBytes]);
}

/** Power query response: power is ON */
export const PWR_ON = fixturePacket('PWR01');
/** Power query response: power is OFF (standby) */
export const PWR_OFF = fixturePacket('PWR00');

/** Volume response: volume at 26 (0x1A) */
export const MVL_26 = fixturePacket('MVL1A');
/** Volume response: volume at 0 */
export const MVL_00 = fixturePacket('MVL00');
/** Volume response: volume at 100 (0x64) */
export const MVL_MAX = fixturePacket('MVL64');

/** Mute on */
export const AMT_ON = fixturePacket('AMT01');
/** Mute off */
export const AMT_OFF = fixturePacket('AMT00');

/** Input: NET */
export const SLI_NET = fixturePacket('SLI2B');
/** Input: CD */
export const SLI_CD = fixturePacket('SLI23');

/** Now playing metadata examples */
export const NTI_TITLE = fixturePacket('NTIMy Song Title');
export const NAT_ARTIST = fixturePacket('NATJohn Coltrane');
export const NAL_ALBUM = fixturePacket('NALA Love Supreme');

/** Playback status: playing */
export const NST_PLAYING = fixturePacket('NSTP--');
/** Playback status: stopped */
export const NST_STOPPED = fixturePacket('NSTS--');
/** Playback status: paused */
export const NST_PAUSED = fixturePacket('NSTx--');

/** Time: current position */
export const NTM_TIME = fixturePacket('NTM01:23/04:56');

/** Track number */
export const NTR_TRACK = fixturePacket('NTR0003/0012');

/** Two packets concatenated (simulates receiving multiple packets at once) */
export const MULTI_PACKET = Buffer.concat([PWR_ON, MVL_26]);

/** Incomplete packet (header only, no payload) */
export const PARTIAL_HEADER = PWR_ON.subarray(0, 16);

/** Partial packet (header + partial payload) */
export const PARTIAL_PAYLOAD = PWR_ON.subarray(0, 20);

/** Garbage bytes before a valid packet */
export const GARBAGE_PREFIX = Buffer.concat([
  Buffer.from([0xFF, 0xFE, 0x00, 0x01]),
  PWR_ON,
]);

/** Empty buffer */
export const EMPTY = Buffer.alloc(0);

/**
 * Packet with EOF terminator style (used by some firmware versions):
 * "!1PWR01\x1a\r\n"
 */
export function fixturePacketEOF(command: string): Buffer {
  const iscpMessage = `!1${command}\x1a\r\n`;
  const messageBytes = Buffer.from(iscpMessage, 'utf-8');

  const header = Buffer.alloc(16);
  Buffer.from('ISCP').copy(header, 0);
  header.writeUInt32BE(16, 4);
  header.writeUInt32BE(messageBytes.length, 8);
  header.writeUInt8(0x01, 12);

  return Buffer.concat([header, messageBytes]);
}

export const PWR_ON_EOF = fixturePacketEOF('PWR01');
