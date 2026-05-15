# Desktop UI QA

Date: 2026-05-15

Target:

- Desktop preview: `http://localhost:5173`
- Service: `http://localhost:8787`
- Mock receiver: `127.0.0.1:60129`

## Environment

Commands used:

```sh
MOCK_MODE=true npm run dev:service
npm run dev -w @o-control/desktop -- --host 127.0.0.1
```

Captured screenshot:

- `docs/uiux-review/desktop-connected.png`
- `docs/uiux-review/desktop-settings-shortcuts.png`
- `docs/uiux-review/web-debug.png`

## Checks

- [x] Connected state renders.
- [x] Header shows receiver summary: input and volume.
- [x] Volume up button calls service and updates volume from 26 to 27.
- [x] Input selector endpoint changes state from NET to USB.
- [x] Now Playing renders mock metadata.
- [x] Preset row renders `Standby` instead of ambiguous `Stop`.
- [x] Settings view renders service URL and shortcut reference.
- [x] Settings view reports native shortcut availability and conflict-safe fallback.
- [x] Web debug UI renders state, controls, and bounded event panel.
- [x] No visible text overlap in connected or settings state.
- [x] Full repo build passes after UI integration.
- [x] Full repo tests pass after UI integration.

## Findings

- Initial button POST requests failed from Vite preview because the service did not allow CORS. Fixed by adding `@fastify/cors` to the service.
- The service preset id `stop` powers the receiver off. UI intentionally labels it `Standby`.
- Native macOS screenshot capture failed in this Codex session due screen capture permissions. Browser automation screenshot capture worked and saved `desktop-connected.png`.
- Tauri shell code is present, but native binary build could not run in this environment because `cargo` is not installed. `npm run tauri:build -w @o-control/desktop` fails before compilation with `cargo metadata` not found.
- Docker Compose smoke initially exposed a missing explicit `@types/node` dev dependency in container builds. Added it to Node workspaces and reran compose successfully.

## Remaining Visual Checks

- Dark mode should be checked on a real macOS dark appearance session.
- Native Tauri menu bar sizing should be checked on a machine with Rust/Cargo installed.
