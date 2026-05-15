# Feature Scope

## MVP Features (Phase 1–4)

### Core Controls
- [x] Power on/off/toggle
- [x] Volume up/down/set (0–100)
- [x] Mute on/off/toggle
- [x] Input selector (CD, NET, USB, Bluetooth, Line, Tuner)
- [x] Playback controls (play, pause, stop, next, previous)

### Service
- [x] Fastify HTTP service with REST API
- [x] WebSocket real-time state events
- [x] eISCP packet builder/parser
- [x] TCP connection with auto-reconnect (exponential backoff)
- [x] Command queue with 50ms minimum interval
- [x] In-memory state store with reducer pattern
- [x] Config validation via environment variables
- [x] Mock/offline mode for development

### API Endpoints
- [x] `GET /health` — Service health check
- [x] `GET /state` — Full receiver state
- [x] `GET /presets` — List available presets
- [x] `POST /commands/power` — Power control
- [x] `POST /commands/volume` — Volume control
- [x] `POST /commands/mute` — Mute control
- [x] `POST /commands/input` — Input selection
- [x] `POST /commands/playback` — Playback control
- [x] `POST /presets/:id/run` — Execute preset
- [x] `GET /events` — WebSocket state stream

### Presets
- [x] Work Jazz: power on → NET input → volume 22
- [x] Focus Quiet: volume 12 → unmute
- [x] Stop: stop playback → standby

### Testing
- [x] eISCP packet builder/parser unit tests
- [x] State store reducer tests
- [x] Mock TCP receiver for integration testing
- [x] Integration tests against mock receiver

### Deployment
- [x] Docker multi-stage build
- [x] Docker Compose with env-driven config
- [x] Health check
- [x] Restart policy

## Extended Features

### Now Playing (Phase 6)
- [x] Title, artist, album parsing (NTI, NAT, NAL)
- [x] Playback status (NST)
- [x] Time elapsed/total (NTM)
- [x] Track number (NTR)

### Raycast Extension (Phase 7)
- [x] Power toggle
- [x] Volume up/down/set
- [x] Mute toggle
- [x] Input switch
- [x] Run preset
- [x] Show status

## Out of Scope (Current)

- ❌ macOS Tauri menu bar app (separate UI/UX track)
- ❌ Web debug UI (separate UI/UX track)
- ❌ Album art (NJA)
- ❌ NAS/USB browser (experimental spike only)
- ❌ Multi-zone control
- ❌ UDP discovery (static IP preferred)
