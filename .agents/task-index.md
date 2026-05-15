# O-Control Agent Task Index

| Task | Owner Scope | Can Run In Parallel | Depends On | Priority |
| --- | --- | --- | --- | --- |
| `01-reference-audit.md` | Docs and technical discovery | Yes | None | P0 |
| `02-eiscp-protocol-package.md` | `packages/eiscp`, shared protocol types | Yes | None | P0 |
| `03-service-api.md` | `packages/service`, service API | Yes, with agreed contract | `packages/shared` contract | P0 |
| `04-desktop-ui-shell.md` | `apps/desktop` UI shell | Yes | Mock API contract | P0 |
| `05-test-harness.md` | Mock receiver and integration tests | Yes | Protocol assumptions | P0 |
| `06-presets-shortcuts.md` | Presets and shortcut behavior | After service/UI skeleton | Service and desktop shell | P1 |
| `07-web-debug-ui.md` | `apps/web` debug UI | After service API | Service API | P2 |
| `08-docker-homelab.md` | Docker, compose, deployment docs | Yes | Service package shape | P1 |
| `09-raycast-extension.md` | `apps/raycast` | After service API | Service API | P2 |
| `10-now-playing.md` | Metadata parsing and UI | After protocol/service | eISCP + service state | P2 |
| `11-nas-usb-browser-spike.md` | Experimental browser spike | Later | Real device logs | P4 |

## Shared Contracts To Stabilize Early

These should be kept in `packages/shared`:

- `OControlState`
- `OControlEvent`
- `CommandRequest`
- `CommandResult`
- `InputId`
- `PlaybackCommand`
- `PresetDefinition`

The service and UI agents should code against these types rather than duplicating local shapes.

