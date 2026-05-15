# eISCP Protocol Notes

## Overview

eISCP (Ethernet Integra Serial Control Protocol) is a TCP-based protocol for controlling Onkyo and Integra AV receivers. It wraps the original RS-232 ISCP protocol in an Ethernet header.

**Default TCP port:** `60128`

---

## Packet Format

### eISCP Header (16 bytes, Big-Endian)

```
Offset  Size   Field        Value
------  -----  -----------  --------------------------------
0x00    4      Magic        "ISCP" (ASCII)
0x04    4      Header Size  16 (always 0x00000010)
0x08    4      Data Size    Length of ISCP payload in bytes
0x0C    1      Version      0x01
0x0D    3      Reserved     0x000000
```

### ISCP Payload

```
!1<COMMAND><PARAMS><TERMINATOR>

! = Start character (always '!')
1 = Unit type ('1' = receiver)
<COMMAND> = 3-character command group (e.g. 'PWR', 'MVL')
<PARAMS> = Variable-length parameters
<TERMINATOR> = \r (some firmware uses \x1a\r\n)
```

### Example: Power On

```
ISCP Header (16 bytes):
  49 53 43 50  00 00 00 10  00 00 00 08  01 00 00 00
  I  S  C  P   headersize    datasize     v  reserved

ISCP Payload (8 bytes):
  21 31 50 57 52 30 31 0D
  !  1  P  W  R  0  1  \r
```

---

## MVP Command Groups

### Power (PWR)

| Command    | Description          |
|-----------|----------------------|
| `PWRQSTN` | Query power status   |
| `PWR01`   | Power on             |
| `PWR00`   | Standby              |

Response: `PWR01` (on) or `PWR00` (standby)

### Volume (MVL)

| Command    | Description            |
|-----------|------------------------|
| `MVLQSTN` | Query volume level     |
| `MVLUP`   | Volume up (1 step)     |
| `MVLDOWN` | Volume down (1 step)   |
| `MVLxx`   | Set volume (hex 00–64) |

Volume range: 0–100 decimal = 0x00–0x64 hex

Example: Volume 26 = `MVL1A`

### Mute (AMT)

| Command    | Description    |
|-----------|----------------|
| `AMTQSTN` | Query mute     |
| `AMT01`   | Mute on        |
| `AMT00`   | Mute off       |

### Input Selector (SLI)

| Command    | Description          | CR-N775 Code |
|-----------|----------------------|--------------|
| `SLIQSTN` | Query current input  |              |
| `SLI23`   | CD                   | 0x23         |
| `SLI2B`   | NET (network)        | 0x2B         |
| `SLI29`   | USB (front/rear)     | 0x29         |
| `SLI2E`   | Bluetooth            | 0x2E         |
| `SLI02`   | Line In              | 0x02         |
| `SLI26`   | Tuner                | 0x26         |

**Note:** Input codes may vary by model. Verify on real CR-N775.

### Network/USB Transport (NTC)

| Command      | Description    |
|-------------|----------------|
| `NTCPLAY`   | Play           |
| `NTCPAUSE`  | Pause          |
| `NTCSTOP`   | Stop           |
| `NTCTRUP`   | Next track     |
| `NTCTRDN`   | Previous track |

---

## Metadata Commands (Phase 2)

### Now Playing Info

| Command    | Description           | Response Format      |
|-----------|----------------------|----------------------|
| `NTI`     | Title                | `NTI<title string>`  |
| `NAT`     | Artist               | `NAT<artist string>` |
| `NAL`     | Album                | `NAL<album string>`  |
| `NST`     | Playback status      | `NST<status chars>`  |
| `NTM`     | Elapsed/total time   | `NTMmm:ss/mm:ss`     |
| `NTR`     | Track current/total  | `NTRcccc/tttt`       |

### NST Playback Status Characters

First character:
- `P` = Playing
- `S` = Stopped
- `p` or `x` = Paused
- `F` = Fast forward
- `R` = Rewind

Second/third characters indicate repeat/shuffle state.

---

## Communication Rules

1. **Keep connection persistent.** The receiver sends unsolicited status updates.
2. **Minimum 50ms between outgoing commands.**
3. **Response is the same command group.** Sending `PWR01` yields `PWR01` response.
4. **No guaranteed response ordering.** Status updates from other sources may interleave.
5. **Reconnect on socket close.** Use exponential backoff.
6. **Query full state after reconnect** (`PWRQSTN`, `MVLQSTN`, `AMTQSTN`, `SLIQSTN`).

---

## CR-N775 Specific Notes

### Unknowns (require real device verification)

- [ ] Exact input hex codes supported (CD, NET, USB, BT, Line, Tuner)
- [ ] Metadata support completeness (does CR-N775 send NTI/NAT/NAL for all sources?)
- [ ] Album art support via `NJA` command
- [ ] NAS/USB browser commands (`NLS`/`NLA`) behavior
- [ ] Network Standby behavior (does it respond to PWR01 from standby?)
- [ ] Firmware version differences in terminator style (\r vs \x1a\r\n)
- [ ] Maximum volume value (some models cap at 80 instead of 100)

### Expected Behavior

- TCP port `60128` should be reachable when Network Standby is enabled
- Power on from standby via `PWR01` should work with Network Standby
- Volume events should be broadcast when physical knob is turned
