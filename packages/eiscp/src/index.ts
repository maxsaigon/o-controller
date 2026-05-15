/**
 * @o-control/eiscp — eISCP Protocol Package
 *
 * Pure packet builder & parser for the Onkyo/Integra eISCP protocol.
 * No network side effects — this package only transforms bytes ↔ commands.
 *
 * eISCP packet layout (16-byte header + variable payload):
 *  ┌──────────┬─────────────┬───────────┬─────────┬──────────┐
 *  │ 'ISCP'   │ headerSize  │ dataSize  │ version │ reserved │
 *  │ 4 bytes  │ 4 bytes BE  │ 4 bytes BE│ 1 byte  │ 3 bytes  │
 *  └──────────┴─────────────┴───────────┴─────────┴──────────┘
 *  Payload = "!1<command>\r"   (ISCP message: start='!', unit='1', CR-terminated)
 */

// ─── Constants ───────────────────────────────────────────────
const ISCP_MAGIC = Buffer.from('ISCP');
const HEADER_SIZE = 16;
const PROTOCOL_VERSION = 0x01;

// ─── Command constants ──────────────────────────────────────
export const COMMANDS = {
  // Power
  POWER_QUERY: 'PWRQSTN',
  POWER_ON: 'PWR01',
  POWER_OFF: 'PWR00',

  // Volume
  VOLUME_QUERY: 'MVLQSTN',
  VOLUME_UP: 'MVLUP',
  VOLUME_DOWN: 'MVLDOWN',
  /** Volume set: append hex value, e.g. 'MVL1A' for 26 */
  VOLUME_SET_PREFIX: 'MVL',

  // Mute
  MUTE_QUERY: 'AMTQSTN',
  MUTE_ON: 'AMT01',
  MUTE_OFF: 'AMT00',

  // Input selector
  INPUT_QUERY: 'SLIQSTN',
  /** Input set: append hex code, e.g. 'SLI2B' for NET */
  INPUT_SET_PREFIX: 'SLI',

  // Playback (NET/USB transport)
  NET_PLAY: 'NTCPLAY',
  NET_PAUSE: 'NTCPAUSE',
  NET_STOP: 'NTCSTOP',
  NET_NEXT: 'NTCTRUP',
  NET_PREV: 'NTCTRDN',

  // Metadata queries
  TITLE_QUERY: 'NTIQSTN',
  ARTIST_QUERY: 'NATQSTN',
  ALBUM_QUERY: 'NALQSTN',
  PLAYBACK_STATUS_QUERY: 'NSTQSTN',
  TIME_QUERY: 'NTMQSTN',
  TRACK_QUERY: 'NTRQSTN',
} as const;

// ─── Packet Builder ─────────────────────────────────────────
/**
 * Build a complete eISCP packet from a raw ISCP command string.
 * @param command Raw ISCP command (e.g. 'PWR01', 'MVLQSTN')
 * @returns Buffer ready to send over TCP
 */
export function buildPacket(command: string): Buffer {
  // ISCP message: !1<command>\r
  const iscpMessage = `!1${command}\r`;
  const messageBytes = Buffer.from(iscpMessage, 'utf-8');

  const header = Buffer.alloc(HEADER_SIZE);
  // Magic 'ISCP'
  ISCP_MAGIC.copy(header, 0);
  // Header size (big-endian uint32)
  header.writeUInt32BE(HEADER_SIZE, 4);
  // Data size (big-endian uint32)
  header.writeUInt32BE(messageBytes.length, 8);
  // Version
  header.writeUInt8(PROTOCOL_VERSION, 12);
  // Reserved (3 bytes, already zeroed by alloc)

  return Buffer.concat([header, messageBytes]);
}

// ─── Parsed Packet ──────────────────────────────────────────
export interface ParsedPacket {
  /** The 3-character command group (e.g. 'PWR', 'MVL') */
  command: string;
  /** The raw payload after the command group (e.g. '01', 'QSTN', '1A') */
  rawPayload: string;
}

// ─── Packet Parser ──────────────────────────────────────────
/**
 * Parse one or more eISCP packets from a byte buffer.
 * Handles partial packets gracefully by returning leftover bytes.
 *
 * @param buffer Raw bytes received from TCP socket
 * @returns Parsed packets and any remaining bytes for the next read
 */
export function parsePackets(buffer: Buffer): {
  packets: ParsedPacket[];
  remaining: Buffer;
} {
  const packets: ParsedPacket[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    // Need at least the header to parse
    if (buffer.length - offset < HEADER_SIZE) {
      break;
    }

    // Validate magic
    const magic = buffer.subarray(offset, offset + 4).toString('ascii');
    if (magic !== 'ISCP') {
      // Try to recover by scanning forward for 'ISCP' magic
      const nextMagic = buffer.indexOf('ISCP', offset + 1, 'ascii');
      if (nextMagic === -1) {
        // No valid packet found in remaining data
        break;
      }
      offset = nextMagic;
      continue;
    }

    const headerSize = buffer.readUInt32BE(offset + 4);
    const dataSize = buffer.readUInt32BE(offset + 8);

    // Check if we have the complete packet
    const totalPacketSize = headerSize + dataSize;
    if (buffer.length - offset < totalPacketSize) {
      // Incomplete packet, wait for more data
      break;
    }

    // Extract ISCP message payload
    const payloadBytes = buffer.subarray(
      offset + headerSize,
      offset + headerSize + dataSize,
    );
    const payloadStr = payloadBytes.toString('utf-8');

    // Parse ISCP message: expected format "!1<command>\r" or "!1<command>\x1a\r\n"
    const parsed = parseISCPMessage(payloadStr);
    if (parsed) {
      packets.push(parsed);
    }

    offset += totalPacketSize;
  }

  return {
    packets,
    remaining: buffer.subarray(offset),
  };
}

/**
 * Parse the inner ISCP message string.
 * Format: "!1<COMMAND_DATA><terminators>"
 * where terminators can be \r, \n, \r\n, \x1a, \x1a\r, \x1a\r\n
 */
function parseISCPMessage(raw: string): ParsedPacket | null {
  // Must start with '!1'
  if (raw.length < 3 || raw[0] !== '!' || raw[1] !== '1') {
    return null;
  }

  // Strip start characters and any trailing terminators
  let data = raw.substring(2);
  // Remove trailing \x1a, \r, \n
  data = data.replace(/[\x1a\r\n]+$/, '');

  if (data.length < 3) {
    return null;
  }

  // First 3 characters are the command group
  const command = data.substring(0, 3);
  const rawPayload = data.substring(3);

  return { command, rawPayload };
}

// ─── Volume Helpers ─────────────────────────────────────────
/**
 * Convert a decimal volume (0–100) to the hex string for MVL command.
 * @param volume Decimal volume value (0–100)
 * @returns Two-character uppercase hex string (e.g. 26 → '1A')
 */
export function volumeToHex(volume: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(volume)));
  return clamped.toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Convert a hex volume string from MVL response to decimal.
 * @param hex Hex string from receiver (e.g. '1A')
 * @returns Decimal volume value (e.g. 26)
 */
export function hexToVolume(hex: string): number {
  const value = parseInt(hex, 16);
  if (isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Build a volume-set command for a specific decimal value.
 */
export function buildVolumeCommand(volume: number): string {
  return `${COMMANDS.VOLUME_SET_PREFIX}${volumeToHex(volume)}`;
}

/**
 * Build an input-select command for a specific input hex code.
 */
export function buildInputCommand(hexCode: string): string {
  return `${COMMANDS.INPUT_SET_PREFIX}${hexCode}`;
}
