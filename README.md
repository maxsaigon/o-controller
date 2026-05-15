# O-Control

Desktop companion for controlling an Onkyo CR-N775 receiver via eISCP protocol.

## Architecture

```
macOS Menu Bar App / Raycast / Web UI
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
| Stop | `stop` | Stop → Standby |

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
  tools/
    mock-receiver/ # TCP mock for testing
  apps/
    raycast/       # Raycast extension
  tests/
    integration/   # End-to-end tests
  infra/
    docker/        # Dockerfile + Compose
  docs/            # Protocol notes, audit, etc.
```

## License

MIT
