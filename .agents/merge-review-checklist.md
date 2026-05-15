# Merge Review Checklist

Use this after all agent branches/patches return.

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

- [ ] eISCP packet builder matches `ISCP` header, header size, data size, version, reserved bytes, and payload terminator.
- [ ] Parser handles multiple packets in one TCP chunk.
- [ ] Parser handles partial packets across chunks.
- [ ] Parser ignores or reports malformed packets without crashing the process.
- [ ] Command queue throttles outbound commands.
- [ ] Query commands and update events share the same state reducer path.
- [ ] Tests include known raw packet fixtures.

## Service Review

- [ ] Service starts without a receiver when mock/offline mode is enabled.
- [ ] Service reconnects after socket close/error.
- [ ] Initial state is queried after connect and after reconnect.
- [ ] HTTP errors are typed and useful.
- [ ] WebSocket broadcasts only normalized state/events, not raw unbounded logs by default.
- [ ] Config validates `ONKYO_HOST`, `ONKYO_PORT`, `O_CONTROL_PORT`, and log level.
- [ ] No receiver IP, token, or local secrets are hard-coded.

## UI Review

- [ ] Menu bar app remains usable in disconnected/reconnecting/error states.
- [ ] Volume slider cannot send excessive command floods while dragging.
- [ ] Buttons are disabled or show pending state while commands are in flight.
- [ ] Text fits in compact menu bar popover.
- [ ] UI does not assume metadata is always present.
- [ ] Keyboard shortcuts are configurable or documented.

## Test Review

- [ ] Unit tests cover packet builder/parser.
- [ ] Integration tests cover connect, query state, command send, event receive, disconnect/reconnect.
- [ ] Mock receiver supports at least power, volume, mute, input, and playback event simulation.
- [ ] `npm test` or equivalent runs from repo root.

## Deployment Review

- [ ] Docker image only includes runtime dependencies.
- [ ] Compose file has healthcheck and restart policy.
- [ ] Service URL and receiver IP are configured via env.
- [ ] README explains LAN-only and Tailscale usage.

## Final Manual Checks

- [ ] Run service against mock receiver.
- [ ] Open desktop app against mock service.
- [ ] Run a short command loop: power query, volume set, mute toggle, input switch.
- [ ] Review all TODO/FIXME comments.
- [ ] Confirm generated docs match actual commands and scripts.

