# O-Control Agent Task Index

Last updated: 2026-05-15

Baseline commits:

- `6579f7c` — Initial O-Control implementation
- `0e8d89e` — Document real receiver verification
- Latest local update: Code-track hardening tests and N100 runbook
- Latest local update: Tauri shell, web debug UI, visual QA screenshots, and Docker smoke validation

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
- Docker Compose smoke: `MOCK_MODE=true`, host port `18787`, `/health` returned `{"status":"ok","connected":true,"mockMode":true,...}`.
- Tauri native build attempt: blocked by missing local Rust/Cargo toolchain before compilation.

## Task Status

| Task | Status | Owner Scope | Next Action | Priority |
| --- | --- | --- | --- | --- |
| `01-reference-audit.md` | Completed | Docs and technical discovery | Keep real-device unknowns updated as new hardware logs appear. | P0 |
| `02-eiscp-protocol-package.md` | Completed | `packages/eiscp`, shared protocol types | Add fixtures only if new CR-N775 packet variants appear. | P0 |
| `03-service-api.md` | Completed | `packages/service`, service API | Route-level tests added. | P0 |
| `04-desktop-ui-shell.md` | Implemented; native build blocked by environment | `apps/desktop` UI shell | Install Rust/Cargo and run native Tauri build/sizing QA on macOS. | P0 |
| `05-test-harness.md` | Completed | Mock receiver and integration tests | Disconnect/reconnect simulation tests added. | P0 |
| `06-presets-shortcuts.md` | Completed | Presets and shortcut behavior | Preset tests and native shortcut registration path added. | P1 |
| `07-web-debug-ui.md` | Completed | `apps/web` debug UI | Maintain only as a secondary service console. | P2 |
| `08-docker-homelab.md` | Completed | Docker, compose, deployment docs | Docker smoke test recorded; rerun on target N100 after deployment. | P1 |
| `09-raycast-extension.md` | Completed for local use | `apps/raycast` | Add publish-ready icon and valid Raycast author metadata if distributing. | P2 |
| `10-now-playing.md` | Completed for MVP | Metadata parsing and UI | Continue logging `NJA`/`NLS` only if album art or browser features are revived. | P2 |
| `11-nas-usb-browser-spike.md` | Completed: postpone | Experimental browser spike | Use real `NLS`/`NJA` logs later if this becomes a priority. | P4 |

## Recommended Next Agent Assignments

1. Native build validation agent:
   - Owns `apps/desktop/src-tauri/**` and native desktop packaging docs.
   - Goal: install/use Rust+Cargo, run `npm run tauri:build -w @o-control/desktop`, and verify macOS tray sizing/focus behavior.
   - Must preserve existing service API contract.

2. Target deployment agent:
   - Owns `infra/docker/**`, `.env.example`, README deployment sections, and `docs/deployment-n100.md`.
   - Goal: rerun the already-validated Docker compose flow on the actual N100 target and record host-specific notes.

3. Distribution polish agent:
   - Owns `apps/raycast/**` and app metadata/icons.
   - Goal: add publish-ready Raycast icon/author metadata and native app icon assets if distribution becomes a goal.

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
