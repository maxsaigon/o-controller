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

## Checks

- [x] Connected state renders.
- [x] Header shows receiver summary: input and volume.
- [x] Volume up button calls service and updates volume from 26 to 27.
- [x] Input selector endpoint changes state from NET to USB.
- [x] Now Playing renders mock metadata.
- [x] Preset row renders `Standby` instead of ambiguous `Stop`.
- [x] Settings view renders service URL and shortcut reference.
- [x] No visible text overlap in connected or settings state.
- [x] Full repo build passes after UI integration.
- [x] Full repo tests pass after UI integration.

## Findings

- Initial button POST requests failed from Vite preview because the service did not allow CORS. Fixed by adding `@fastify/cors` to the service.
- The service preset id `stop` powers the receiver off. UI intentionally labels it `Standby`.
- Native macOS screenshot capture failed in this Codex session due screen capture permissions. Browser automation screenshot capture worked and saved `desktop-connected.png`.

## Remaining Visual Checks

- Dark mode should be checked on a real macOS dark appearance session.
- Offline/reconnecting state should be checked after service disconnect.
- Native Tauri menu bar sizing still needs verification once Tauri shell is added.
