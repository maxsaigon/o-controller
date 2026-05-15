# Merge Review Checklist

Use this after all agent branches/patches return.

Status updated: 2026-05-15.

This checklist now reflects the integrated MVP in commit `6579f7c`, real receiver README update in `0e8d89e`, and the completed code-track hardening work.

## Required Review Order

1. `packages/shared`
2. `packages/eiscp`
3. `packages/service`
4. `tests` / mock receiver
5. `apps/desktop`
6. `infra/docker`
7. Optional apps: `apps/web`, `apps/raycast`
8. Experimental features: now playing, NAS/USB browser

## Protocol Review

- [x] eISCP packet builder matches `ISCP` header, header size, data size, version, reserved bytes, and payload terminator.
- [x] Parser handles multiple packets in one TCP chunk.
- [x] Parser handles partial packets across chunks.
- [x] Parser ignores or reports malformed packets without crashing the process.
- [x] Command queue throttles outbound commands.
- [x] Query commands and update events share the same state reducer path.
- [x] Tests include known raw packet fixtures.

## Service Review

- [x] Service starts without a receiver when mock/offline mode is enabled.
- [x] Service reconnects after socket close/error.
- [x] Initial state is queried after connect and after reconnect.
- [x] HTTP errors are typed and useful.
- [x] WebSocket broadcasts only normalized state/events, not raw unbounded logs by default.
- [x] Config validates `ONKYO_HOST`, `ONKYO_PORT`, `O_CONTROL_PORT`, and log level.
- [x] No receiver IP, token, or local secrets are hard-coded.
- [x] Dedicated route-level tests cover validation and HTTP errors.
- [x] Reconnect behavior is covered by deterministic integration tests.

## UI Review

- [ ] Native menu bar app remains usable in disconnected/reconnecting/error states.
- [x] Browser-hosted desktop UI remains usable in disconnected/reconnecting/error states.
- [x] Volume slider cannot send excessive command floods while dragging.
- [x] Buttons are disabled or show pending state while commands are in flight.
- [x] Text fits in compact menu bar popover.
- [x] UI does not assume metadata is always present.
- [ ] Keyboard shortcuts are configurable or documented in native shell.

## Test Review

- [x] Unit tests cover packet builder/parser.
- [x] Integration tests cover connect, query state, command send, and event receive.
- [x] Integration tests cover disconnect/reconnect.
- [x] Mock receiver supports at least power, volume, mute, input, and playback event simulation.
- [x] `npm run test:all` runs from repo root.

## Deployment Review

- [x] Docker image only includes runtime dependencies.
- [x] Compose file has healthcheck and restart policy.
- [x] Service URL and receiver IP are configured via env.
- [x] README explains LAN-only and Tailscale usage.
- [x] N100 deployment runbook exists at `docs/deployment-n100.md`.
- [ ] Docker build/compose smoke test is recorded.

## Final Manual Checks

- [x] Run service against mock receiver.
- [x] Open desktop app against mock service.
- [x] Run service against real CR-N775 at `192.168.1.104`.
- [x] Run a short command loop: power query, volume set, mute toggle, input readback.
- [x] Review all TODO/FIXME comments.
- [x] Confirm generated docs match actual commands and scripts.
