# Task 07: Web Debug UI

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

