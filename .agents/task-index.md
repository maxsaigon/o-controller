# O-Control Agent Task Index

Last updated: 2026-05-15

Baseline commits:

- `6579f7c` — Initial O-Control implementation
- `0e8d89e` — Document real receiver verification
- Latest local update: Code-track hardening tests and N100 runbook

Real-device verification:

- Device: Onkyo CR-N775 at `192.168.1.104`
- eISCP TCP: `60128`
- Verified: service connection, state readback, WebSocket UI state, volume set/restore, mute on/off, input readback, playback readback.
- Last observed state: power `on`, input `net`, volume `17`, muted `false`, playback `stopped`.

Latest automated verification:

- `npm run build`
- `npm run lint`
- `npm run test:all`: 133 tests passing: 93 unit, 24 route-level, 16 integration.
- `npm audit --audit-level=high`

## Task Status

| Task | Status | Owner Scope | Next Action | Priority |
| --- | --- | --- | --- | --- |
| `01-reference-audit.md` | Completed | Docs and technical discovery | Keep real-device unknowns updated as new hardware logs appear. | P0 |
| `02-eiscp-protocol-package.md` | Completed | `packages/eiscp`, shared protocol types | Add fixtures only if new CR-N775 packet variants appear. | P0 |
| `03-service-api.md` | Completed | `packages/service`, service API | Route-level tests added. | P0 |
| `04-desktop-ui-shell.md` | Partial | `apps/desktop` UI shell | Package current React/Vite UI into native Tauri menu bar/tray shell. | P0 |
| `05-test-harness.md` | Completed | Mock receiver and integration tests | Disconnect/reconnect simulation tests added. | P0 |
| `06-presets-shortcuts.md` | Completed for code track | Presets and shortcut behavior | Preset order and error tests added. Global shortcuts deferred to Tauri shell. | P1 |
| `07-web-debug-ui.md` | Not started | `apps/web` debug UI | Build only if browser debug UI is still needed after desktop UI. | P2 |
| `08-docker-homelab.md` | Completed | Docker, compose, deployment docs | N100 deployment runbook added at `docs/deployment-n100.md`. | P1 |
| `09-raycast-extension.md` | Completed for local use | `apps/raycast` | Add publish-ready icon and valid Raycast author metadata if distributing. | P2 |
| `10-now-playing.md` | Completed for MVP | Metadata parsing and UI | Continue logging `NJA`/`NLS` only if album art or browser features are revived. | P2 |
| `11-nas-usb-browser-spike.md` | Completed: postpone | Experimental browser spike | Use real `NLS`/`NJA` logs later if this becomes a priority. | P4 |

## Recommended Next Agent Assignments

1. Native desktop shell agent:
   - Owns `apps/desktop/**` plus Tauri config.
   - Goal: convert the verified browser UI into a macOS menu bar/tray app.
   - Must preserve existing service API contract.

2. Shortcut and visual QA agent:
   - Should wait for native Tauri shell.
   - Goal: global shortcuts, shortcut conflict handling, and additional desktop screenshots.

3. Optional web debug UI agent:
   - Owns `apps/web/**` if a browser-based service console is still useful.
   - Goal: build a small debug UI without changing the verified desktop workflow.

4. Docker deployment validation agent:
   - Owns `infra/docker/**`, `.env.example`, README deployment sections, and `docs/deployment-n100.md`.
   - Goal: run real Docker build/compose smoke test on local Docker or the N100 target and record the result.

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
