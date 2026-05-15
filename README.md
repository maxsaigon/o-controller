# O-Control

Desktop companion for controlling an Onkyo CR-N775 receiver via eISCP protocol.

## Current Status

O-Control has been implemented and verified against a real Onkyo CR-N775 on the local network.

Verified on 2026-05-15:

- TCP eISCP connection to CR-N775 on port `60128`.
- Live state query through the service API.
- Real-time WebSocket state updates in the desktop UI.
- Power state readback.
- Volume readback and volume set.
- Mute on/off.
- Input readback.
- Playback state readback.
- Now-playing metadata fallback when title/artist/album are empty.
- Desktop browser UI at `http://127.0.0.1:5173`.
- Service API at `http://127.0.0.1:8787`.
- Mock mode, mock receiver integration tests, build, lint, and audit checks.

Observed real-device state during verification:

```json
{
  "connected": true,
  "power": "on",
  "input": "net",
  "volume": 17,
  "muted": false,
  "playback": "stopped"
}
```

The receiver also emits NET/USB list events such as `NLS` and album art URL events such as `NJA`; these are logged for future NAS/USB browser work but are intentionally outside the MVP control surface.

## Architecture

```
Desktop UI / Raycast / Web UI
              │
        HTTP + WebSocket
              │
       O-Control Service
              │
        TCP eISCP :60128
              │
       Onkyo CR-N775
```

## Quick Start

### Prerequisites

- Node.js 20+
- Onkyo CR-N775 with Network Standby enabled and a static IP

### Install

```bash
npm install
```

### Run in Mock Mode (no receiver needed)

```bash
MOCK_MODE=true npm run dev:service
```

### Run with Real Receiver

```bash
cp .env.example .env
# Edit .env with your receiver's IP
npm run dev:service
```

For the verified local CR-N775 setup:

```bash
ONKYO_HOST=192.168.1.104 ONKYO_PORT=60128 O_CONTROL_PORT=8787 MOCK_MODE=false npm run dev:service
```

### Run Desktop UI

In another terminal:

```bash
npm run dev -w @o-control/desktop -- --host 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173/
```

### Run Mock Receiver (for testing)

```bash
npm run dev:mock
```

### Run Tests

```bash
npm test
```

### Run Integration Tests

```bash
npm run test:integration
```

### Run All Verification Tests

```bash
npm run test:all
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/state` | GET | Full receiver state |
| `/presets` | GET | List presets |
| `/commands/power` | POST | `{ action: "on" \| "off" \| "toggle" }` |
| `/commands/volume` | POST | `{ value: "up" \| "down" \| 0-100 }` |
| `/commands/mute` | POST | `{ action: "on" \| "off" \| "toggle" }` |
| `/commands/input` | POST | `{ input: "cd" \| "net" \| "usb" \| ... }` |
| `/commands/playback` | POST | `{ action: "play" \| "pause" \| "stop" \| ... }` |
| `/presets/:id/run` | POST | Run a preset by ID |
| `/events` | WS | Real-time state stream |

## Presets

| Preset | ID | Description |
|--------|----|-------------|
| Work Jazz | `work-jazz` | Power on → NET → Volume 22 |
| Focus Quiet | `focus-quiet` | Volume 12 → Unmute |
| Standby | `stop` | Stop → Standby |

## Verified Control Surface

The current desktop UI supports:

- Connection status and receiver summary.
- Power toggle.
- Mute toggle.
- Volume slider plus step up/down buttons.
- Playback controls.
- Input selector for CD, NET, USB, Bluetooth, Line, and Tuner.
- Preset buttons.
- Now-playing display with safe empty-metadata fallback.
- Service URL settings.

The current Raycast extension supports:

- Power toggle.
- Volume up/down/set.
- Mute toggle.
- Input switch.
- Preset runner.
- Status viewer.

## Docker

```bash
cd infra/docker
docker compose up -d
```

See [Docker Compose config](infra/docker/docker-compose.yml) for env vars.

## Project Structure

```
o-control/
  packages/
    shared/        # Types, constants, contracts
    eiscp/         # eISCP packet builder/parser
    service/       # Fastify HTTP/WS service
  apps/
    desktop/       # React/Vite desktop companion UI
    raycast/       # Raycast extension
  tools/
    mock-receiver/ # TCP mock for testing
  tests/
    integration/   # End-to-end tests
  infra/
    docker/        # Dockerfile + Compose
  docs/            # Protocol notes, audit, etc.
```

## Known Follow-Ups

- Package the desktop UI as a native macOS menu bar app with Tauri.
- Verify keyboard shortcut registration in the native shell.
- Continue real-device logging for `NLS`/`NJA` if NAS/USB browsing becomes worth building.
- Add a publish-ready Raycast icon and Raycast author metadata if distributing the extension publicly.

## License

MIT
