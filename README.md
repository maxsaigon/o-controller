# O-Control

O-Control is a small macOS menu-bar controller for an Onkyo CR-N775 / N775 receiver.

The intended flow is simple:

```text
Install app -> set receiver IP -> control N775
```

The app talks to the receiver over Onkyo eISCP on TCP port `60128`. A local service is bundled with the macOS app and is started by the Tauri shell, so normal use does not require running a separate server by hand.

## Current Status

O-Control has been verified against a real Onkyo CR-N775 on the local network.

Verified on 2026-05-15:

- TCP eISCP connection to the receiver on port `60128`.
- Power state readback and power toggle.
- Volume readback, volume up/down, and volume set.
- Mute on/off.
- Input readback and input switching.
- Playback status readback and playback controls.
- Now-playing fallback when title, artist, or album are empty.
- Real-time state updates in the desktop UI.
- Native macOS Tauri shell with tray/menu wiring.
- Local service sidecar startup path.
- Global shortcut registration path.

The receiver also emits NET/USB list events such as `NLS` and album-art URL events such as `NJA`. Those are logged for future investigation but are not part of the current product.

## Product Architecture

```text
macOS menu-bar app
        |
        | HTTP + WebSocket on localhost
        v
local O-Control service
        |
        | TCP eISCP :60128
        v
Onkyo CR-N775 / N775
```

## Install And Use

### Receiver Setup

Before using the app:

- Enable Network Standby on the receiver.
- Give the receiver a static IP or DHCP reservation.
- Confirm the receiver is reachable from the Mac on the same local network.

The verified local setup used:

```text
Receiver IP: 192.168.1.104
eISCP port: 60128
```

### Build The macOS App

Requirements:

- Node.js 20+
- Rust toolchain with `cargo`

Install dependencies:

```bash
npm install
```

Build the standalone macOS app:

```bash
npm run build:app
```

The `.app` and `.dmg` outputs are written under:

```text
apps/desktop/src-tauri/target/release/bundle/
```

### First Run

1. Open O-Control.
2. Open Settings from the popover.
3. Set the receiver IP address.
4. Leave the port as `60128`.
5. Test the connection.
6. Use the menu-bar popover to control power, volume, mute, input, playback, and presets.

## Controls

The desktop app supports:

- Connection status and receiver summary.
- Power toggle.
- Volume slider and step up/down buttons.
- Mute toggle.
- Input selector for CD, NET, USB, Bluetooth, Line, and Tuner.
- Playback controls: play, pause, stop, previous, next.
- Preset buttons.
- Now-playing display with safe fallback for missing metadata.
- Native global shortcuts for volume, mute, play/pause, and show/hide.

Default presets:

| Preset | ID | Behavior |
| --- | --- | --- |
| Work Jazz | `work-jazz` | Power on -> NET -> Volume 22 -> Unmute |
| Focus Quiet | `focus-quiet` | Volume 12 -> Unmute |
| Standby | `stop` | Stop playback -> Standby |

## Development

For normal product work, use the Tauri desktop shell:

```bash
npm run tauri:dev -w @o-control/desktop
```

To run only the service against a real receiver:

```bash
ONKYO_HOST=192.168.1.104 ONKYO_PORT=60128 O_CONTROL_PORT=8787 MOCK_MODE=false npm run dev:service
```

To run the service without a receiver:

```bash
MOCK_MODE=true npm run dev:service
```

To run the browser preview of the desktop UI:

```bash
npm run dev -w @o-control/desktop -- --host 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173/
```

Run tests:

```bash
npm test
```

Run integration tests:

```bash
npm run test:integration
```

## Local Service API

The desktop app uses this localhost API internally.

| Endpoint | Method | Description |
| --- | --- | --- |
| `/health` | GET | Health check |
| `/state` | GET | Full receiver state |
| `/presets` | GET | List presets |
| `/commands/power` | POST | `{ action: "on" \| "off" \| "toggle" }` |
| `/commands/volume` | POST | `{ value: "up" \| "down" \| 0-100 }` |
| `/commands/mute` | POST | `{ action: "on" \| "off" \| "toggle" }` |
| `/commands/input` | POST | `{ input: "cd" \| "net" \| "usb" \| "bluetooth" \| "line" \| "tuner" }` |
| `/commands/playback` | POST | `{ action: "play" \| "pause" \| "stop" \| "next" \| "previous" }` |
| `/presets/:id/run` | POST | Run a preset |
| `/events` | WS | Real-time state stream |

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

## Repository Map

Core product code:

```text
packages/eiscp/       eISCP packet builder/parser
packages/service/     Local HTTP/WebSocket service and receiver TCP client
packages/shared/      Shared types and command constants
apps/desktop/         macOS Tauri app and React popover UI
```

Supporting tools:

```text
tools/mock-receiver/  TCP mock for tests
tests/integration/    Service integration tests
apps/web/             Optional debug console
apps/raycast/         Optional Raycast extension
infra/docker/         Optional container smoke/deployment path
docs/                 Protocol notes and planning documents
```

## Scope Boundary

In scope now:

- Reliable local macOS control of one Onkyo CR-N775 / N775.
- Static receiver IP configuration.
- Core remote-control actions.
- Basic now-playing state when the receiver provides it.

Out of scope for the current product:

- Full NAS/USB browser.
- Album art.
- Multi-zone control.
- UDP discovery.
- macOS Control Center widgets.
- Homelab/N100 deployment as the primary path.

## License

MIT
