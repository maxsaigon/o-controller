# Task 07: Web Debug UI

Status: Not started.

Decision note:

- The React/Vite desktop UI already runs in a browser at `http://127.0.0.1:5173` and has been verified against the real receiver.
- A separate `apps/web` debug UI is optional and should only be built if there is a clear debugging need beyond the current desktop preview.

## Goal

Build a lightweight browser UI for LAN control and debugging.

## Ownership

You own:

- `apps/web/**`
- Web-specific docs

Do not edit desktop app or service internals.

## Work Items

- [ ] Create web app shell.
- [ ] Connect to service `/state` and `/events`.
- [ ] Build control surface for power, volume, mute, input, playback.
- [ ] Add raw event/debug panel.
- [ ] Add responsive layout for desktop/tablet.
- [ ] Add disconnected/error states.

## Follow-Up Work

- If this task is revived, keep it debug-oriented: state panel, raw bounded event panel, and core controls.
- Do not duplicate protocol logic or create a second divergent control API.

## Acceptance Criteria

- Web UI works against mock service.
- Debug panel is bounded and cannot grow forever.
- UI is secondary and does not introduce service-specific assumptions not in shared types.

## Return Format

Return:

- Files changed
- How to run web UI
- Screenshots if available
- Tests run
