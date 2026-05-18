# Prototype Plan

This plan keeps the prototype focused on the product flow described in the README:

```text
Install app -> set receiver IP -> control N775
```

The prototype target is a macOS menu-bar app that runs a local sidecar service, connects to one Onkyo CR-N775 / N775 by static IP, and controls the receiver through eISCP on TCP port `60128`.

## Goal

Complete the prototype so a user can:

1. Build or open the macOS app.
2. Set the receiver IP address.
3. Confirm the app connects to the local service and receiver.
4. Control power, volume, mute, input, playback, and presets from the app.

## Non-Goals

Do not add or polish these for the prototype:

- NAS/USB browser.
- Album art.
- Raycast distribution or Raycast UI polish.
- Docker/N100/homelab deployment.
- Web debug UI beyond keeping existing code from breaking.
- UDP discovery.
- Multi-zone control.
- macOS Control Center widgets.
- Large UI redesign.
- General preset/config framework work beyond the existing defaults.

## Primary Path

```text
apps/desktop
  -> local Tauri sidecar
  -> packages/service
  -> packages/eiscp
  -> Onkyo CR-N775 / N775
```

Supporting apps and tools are not part of the prototype acceptance path.

## Task List

### 1. Confirm README-Aligned Scope

- [x] Read `README.md`.
- [x] Treat `apps/desktop` as the only product app for the prototype.
- [x] Treat `packages/service`, `packages/eiscp`, and `packages/shared` as the core backend path.
- [x] Do not use `apps/web`, `apps/raycast`, or `infra/docker` as prototype blockers.

### 2. Verify Local Sidecar Startup

- [x] Run `npm run build:sidecar`.
- [x] Run `npm run tauri:dev -w @o-control/desktop`.
- [x] Confirm Tauri starts the local `o-control-service` sidecar.
- [x] Confirm service status resolves to `http://127.0.0.1:8787`.
- [x] Confirm `/health` responds while the desktop app is running.
- [x] Confirm the app stops the local sidecar on quit.

### 3. Complete Receiver IP Settings

- [x] Confirm Settings exposes receiver host/IP.
- [x] Confirm port defaults to `60128`.
- [x] Confirm saved host/IP persists across app restarts.
- [x] Confirm local service receives the saved IP as `ONKYO_HOST`.
- [x] Confirm changing host/IP restarts or reapplies the local service config clearly.
- [x] Confirm the UI distinguishes service offline from receiver offline.

### 4. Verify Core Controls

- [x] Power toggle sends the correct command and updates state.
- [x] Volume up sends one step command.
- [x] Volume down sends one step command.
- [x] Volume set sends a bounded `0-100` value.
- [x] Mute toggle sends the correct command and updates state.
- [x] Input selector supports CD, NET, USB, Bluetooth, Line, and Tuner.
- [x] Playback controls support play, pause, stop, next, and previous.
- [x] Controls are disabled when the receiver is unavailable, except power-on behavior if supported.
- [x] Command errors show a short visible error and do not crash the app.

### 5. Verify Presets

- [x] `work-jazz` runs: power on -> NET -> volume 22 -> unmute.
- [x] `focus-quiet` runs: volume 12 -> unmute.
- [x] `stop` runs: stop playback -> standby.
- [x] Preset buttons show pending state while running.
- [x] Preset failure shows a short visible error.

### 6. Verify State Updates

- [x] Initial state loads through `GET /state`.
- [x] Real-time state updates arrive through `/events`.
- [x] Physical receiver volume changes update the UI when events are emitted.
- [x] Receiver disconnect marks receiver offline without crashing the app.
- [x] Reconnect triggers fresh state queries.
- [x] Empty now-playing metadata renders a safe fallback.

### 7. Build The macOS App

- [x] Run `npm run build:app`.
- [x] Confirm `.app` output exists under `apps/desktop/src-tauri/target/release/bundle/`.
- [x] Confirm `.dmg` output exists if Tauri packaging creates one.
- [x] Open the built app if the local environment allows it.
- [x] Confirm the built app starts the local service sidecar.

### 8. Run Required Tests

- [x] Run `npm test`.
- [x] Run `npm run test:integration`.
- [x] Record any failures with exact command output and affected file paths.

## Acceptance Criteria

The prototype is complete when:

- [x] `README.md` accurately describes the current product path.
- [x] `npm test` passes.
- [x] `npm run test:integration` passes.
- [x] `npm run build:app` passes.
- [x] The macOS app opens.
- [x] The macOS app starts the local sidecar service.
- [x] The user can set the receiver IP address.
- [x] The local service connects to a real receiver or mock mode.
- [x] The desktop UI can send all core controls.
- [x] The desktop UI receives state updates.
- [x] No new out-of-scope feature has been added.

## Debug Priority

Fix issues in this order:

1. Tauri local service sidecar does not start.
2. Receiver IP setting is not passed to the service.
3. Service cannot connect to receiver.
4. WebSocket state does not update the UI.
5. Core commands fail.
6. `npm run build:app` fails.
7. Minor UI polish.

## Notes For Agents

- Keep edits small and tied to the task list.
- Prefer fixing the product path over improving optional tools.
- Do not refactor unrelated packages.
- Do not make Raycast, Docker, or web debug work block prototype completion.
- If a real receiver is unavailable, verify with mock mode and clearly mark real-device verification as pending.
