# Reference Audit

## Purpose

Evaluate existing open-source Onkyo/Integra controller implementations as references for O-Control, without copying GPL code.

---

## Repository Analysis

### mkulesh/onpc (GPL-3.0)

**Role:** Full-featured Onkyo/Pioneer controller (Android/desktop)

**Key learnings:**
- Comprehensive state model covering power, volume, input, playback, metadata, zones
- Handles NET/USB list navigation via `NLS`/`NLA` commands
- Robust reconnection behavior with state re-query after connect
- Supports many receiver models including CR-N775/CR-N775D
- Complex UI for media browsing, multi-zone control, custom presets

**Relevant for O-Control:**
- ✅ State model structure (power, volume, mute, input, playback, metadata)
- ✅ Command groups and expected response patterns
- ✅ Reconnection strategy (exponential backoff + full state query)
- ✅ NST playback status character codes (P=playing, S=stopped, x/p=paused)
- ❌ UI complexity — O-Control needs compact desktop remote, not media center
- ❌ GPL-3.0 license — cannot copy code

### miracle2k/onkyo-eiscp (MIT-like)

**Role:** Python eISCP library and CLI

**Key learnings:**
- Clear eISCP packet format documentation in code
- Header: 4b magic 'ISCP' + 4b headerSize(16) + 4b dataSize + 1b version(0x01) + 3b reserved
- Payload: `!1<command>\r` (start='!', unit='1', CR terminated)
- Some firmware variants use `\x1a\r\n` as terminator
- Command groups are always 3 characters (PWR, MVL, AMT, SLI, etc.)
- Volume values are hex-encoded (0x00–0x64 = 0–100)
- Minimum 50ms interval between commands recommended
- UDP discovery on port 60128 with `!xECNQSTN` packet

**Relevant for O-Control:**
- ✅ Packet builder/parser implementation pattern
- ✅ Command mapping database
- ✅ Discovery protocol (optional, we use static IP)
- ✅ Volume hex conversion helpers

### jhesch/integra (MIT)

**Role:** Go-based HTTP/WebSocket server for Integra receivers

**Key learnings:**
- Clean architecture: TCP client ↔ state store ↔ HTTP/WS API
- REST endpoints for command execution
- WebSocket for real-time state broadcasting
- State broadcast on every change (not polling)
- Simple JSON event shape

**Relevant for O-Control:**
- ✅ Service architecture pattern (very close to our design)
- ✅ REST API design
- ✅ WebSocket state broadcasting pattern

### tillbaks/node-eiscp (ISC License)

**Role:** Node.js eISCP library

**Key learnings:**
- Older package, uses callbacks
- Has a large command mapping YAML/JSON
- Supports discovery
- Some issues with newer Node.js versions

**Relevant for O-Control:**
- ⚠️ Command mapping reference only
- ❌ Not suitable as a dependency (older patterns, potential Node compat issues)

### ava-brn/lib-eiscp (MIT)

**Role:** Newer JavaScript eISCP library

**Key learnings:**
- Cleaner API than tillbaks/node-eiscp
- Promise-based
- Smaller scope

**Relevant for O-Control:**
- ⚠️ Alternative PoC reference
- ❌ Building custom adapter gives more control

### estbeetoo/node-red-contrib-eiscp

**Role:** Node-RED integration nodes

**Key learnings:**
- Automation patterns (trigger on state change)
- Raw command passthrough

**Relevant for O-Control:**
- ⚠️ Automation pattern inspiration only

---

## Build/Buy Decision

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Use `onpc` desktop as-is | Full-featured, tested | No menu bar, no global shortcuts, no presets API, GPL | ❌ Insufficient for macOS workflow |
| Wrapper around `onpc` | Reuse mature controller | Still need service layer, GPL boundary unclear | ❌ Complexity without benefit |
| Build O-Control custom | Exact features needed, MIT license, compact macOS UX | Development time | ✅ Proceed |

**Decision: Build O-Control as a custom, minimal, macOS-first controller.**

Rationale:
1. `onpc` is a great reference but doesn't solve the "menu bar + keyboard shortcut + preset" workflow
2. eISCP protocol is simple enough to implement independently (~200 lines for packet builder/parser)
3. Service architecture is straightforward (Fastify + WebSocket + TCP client)
4. Custom implementation avoids GPL licensing constraints

---

## Feature Scope Comparison

| Feature | onpc | O-Control MVP | O-Control Future |
|---------|------|---------------|------------------|
| Power on/off | ✅ | ✅ | ✅ |
| Volume control | ✅ | ✅ | ✅ |
| Mute | ✅ | ✅ | ✅ |
| Input selector | ✅ | ✅ | ✅ |
| Playback controls | ✅ | ✅ | ✅ |
| Now Playing metadata | ✅ | ✅ | ✅ |
| Album art | ✅ | ❌ | Maybe |
| Menu bar app | ❌ | ✅ | ✅ |
| Global keyboard shortcuts | ❌ | ✅ | ✅ |
| Presets / macros | ❌ | ✅ | ✅ |
| Multi-zone | ✅ | ❌ | Maybe |
| NAS/USB browser | ✅ | ❌ | Spike |
| REST API | ❌ | ✅ | ✅ |
| WebSocket events | ❌ | ✅ | ✅ |
| Raycast integration | ❌ | ✅ | ✅ |
| Docker deployment | ❌ | ✅ | ✅ |
