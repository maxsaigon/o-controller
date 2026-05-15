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
- Optional web debug UI at `http://127.0.0.1:5174`.
- Service API at `http://127.0.0.1:8787`.
- Native Tauri shell code, tray/menu wiring, and shortcut registration path.
- Docker Compose smoke test in mock mode on host port `18787`.
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

### Run Native Desktop Shell

The Tauri shell wraps the same React UI with a macOS tray/menu-bar entry, close-to-tray behavior, and global shortcut registration.

```bash
npm run tauri:dev -w @o-control/desktop
```

Native builds require a Rust toolchain with `cargo` available:

```bash
npm run tauri:build -w @o-control/desktop
```

### Run Web Debug UI

In another terminal:

```bash
npm run dev -w @o-control/web
```

Then open:

```text
http://127.0.0.1:5174/
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
- Tauri tray/menu-bar shell config.
- Native global shortcut registration for volume up/down, mute, play/pause, and show/hide popover.

The optional web debug UI supports:

- State panel using `GET /state`.
- Core command controls.
- Preset runner.
- Bounded raw `/events` stream with the latest 80 events.

The current Raycast extension supports:

- Power toggle.
- Volume up/down/set.
- Mute toggle.
- Input switch.
- Preset runner.
- Status viewer.

## Docker

Docker is intended for deployment and occasional smoke checks, not the main Mac development loop. Use host Node for local service/UI work, then use Compose only to validate the container path.

```bash
O_CONTROL_PORT=18787 MOCK_MODE=true LOG_LEVEL=silent docker compose -f infra/docker/docker-compose.yml up -d --build
curl http://127.0.0.1:18787/health
docker compose -f infra/docker/docker-compose.yml down
```

The Dockerfile uses BuildKit npm cache mounts and the repo includes a `.dockerignore`, so repeated smoke runs should reuse dependency layers unless package manifests change. For N100 deployment, the preferred long-term path is to build/publish the image from CI and have the Mini PC pull that image instead of building Node dependencies locally.

The smoke test above was verified locally on 2026-05-15. See [Docker Compose config](infra/docker/docker-compose.yml) for env vars and [N100 deployment runbook](docs/deployment-n100.md) for target-host deployment.

## Project Structure

```
o-control/
  packages/
    shared/        # Types, constants, contracts
    eiscp/         # eISCP packet builder/parser
    service/       # Fastify HTTP/WS service
  apps/
    desktop/       # React/Vite desktop companion UI
    web/           # Optional browser debug console
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

- Install Rust/Cargo on macOS build machines before running `npm run tauri:build`.
- Continue real-device logging for `NLS`/`NJA` if NAS/USB browsing becomes worth building.
- Add a publish-ready Raycast icon and Raycast author metadata if distributing the extension publicly.

## License

MIT
