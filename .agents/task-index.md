# O-Control Agent Task Index

Last updated: 2026-05-15

Baseline commits:

- `6579f7c` — Initial O-Control implementation
- `0e8d89e` — Document real receiver verification

Real-device verification:

- Device: Onkyo CR-N775 at `192.168.1.104`
- eISCP TCP: `60128`
- Verified: service connection, state readback, WebSocket UI state, volume set/restore, mute on/off, input readback, playback readback.
- Last observed state: power `on`, input `net`, volume `17`, muted `false`, playback `stopped`.

## Task Status

| Task | Status | Owner Scope | Next Action | Priority |
| --- | --- | --- | --- | --- |
| `01-reference-audit.md` | Completed | Docs and technical discovery | Keep real-device unknowns updated as new hardware logs appear. | P0 |
| `02-eiscp-protocol-package.md` | Completed | `packages/eiscp`, shared protocol types | Add fixtures only if new CR-N775 packet variants appear. | P0 |
| `03-service-api.md` | Completed for MVP | `packages/service`, service API | Optional: add Fastify route-level tests beyond reducer/integration coverage. | P0 |
| `04-desktop-ui-shell.md` | Partial | `apps/desktop` UI shell | Package current React/Vite UI into native Tauri menu bar/tray shell. | P0 |
| `05-test-harness.md` | Mostly complete | Mock receiver and integration tests | Add explicit disconnect/reconnect simulation tests. | P0 |
| `06-presets-shortcuts.md` | Partial | Presets and shortcut behavior | Add native global shortcuts after Tauri shell exists; add preset order tests. | P1 |
| `07-web-debug-ui.md` | Not started | `apps/web` debug UI | Build only if browser debug UI is still needed after desktop UI. | P2 |
| `08-docker-homelab.md` | Mostly complete | Docker, compose, deployment docs | Run Docker build/compose smoke test on target host or local Docker. | P1 |
| `09-raycast-extension.md` | Completed for local use | `apps/raycast` | Add publish-ready icon and valid Raycast author metadata if distributing. | P2 |
| `10-now-playing.md` | Completed for MVP | Metadata parsing and UI | Continue logging `NJA`/`NLS` only if album art or browser features are revived. | P2 |
| `11-nas-usb-browser-spike.md` | Completed: postpone | Experimental browser spike | Use real `NLS`/`NJA` logs later if this becomes a priority. | P4 |

## Recommended Next Agent Assignments

1. Native desktop shell agent:
   - Owns `apps/desktop/**` plus Tauri config.
   - Goal: convert the verified browser UI into a macOS menu bar/tray app.
   - Must preserve existing service API contract.

2. Reconnect/test-hardening agent:
   - Owns `packages/service/**`, `tools/mock-receiver/**`, `tests/integration/**`.
   - Goal: add deterministic disconnect/reconnect tests and route tests.
   - Must not change UI behavior.

3. Docker deployment agent:
   - Owns `infra/docker/**`, `.env.example`, README deployment sections.
   - Goal: run real Docker build/compose smoke test and document exact N100 deployment steps.

4. Shortcut/preset polish agent:
   - Should wait for native Tauri shell.
   - Goal: global shortcuts, shortcut conflict handling, and explicit preset order tests.

## Shared Contracts To Stabilize Early

These are implemented in `packages/shared` and should remain the integration contract:

- `OControlState`
- `OControlEvent`
- `CommandRequest`
- `CommandResult`
- `InputId`
- `PlaybackCommand`
- `PresetDefinition`

The service and UI agents should code against these types rather than duplicating local shapes.
