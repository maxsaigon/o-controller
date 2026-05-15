# Task 04: macOS Desktop UI Shell

## Goal

Build the Tauri + React desktop shell for O-Control's menu bar companion experience.

## Ownership

You own:

- `apps/desktop/**`
- Desktop-specific UI components
- Desktop-specific config docs if needed

Do not edit service implementation.

## UX Direction

Compact macOS productivity remote:

- Menu bar first.
- Small popover.
- Fast controls.
- No landing page.
- No decorative marketing UI.

## Work Items

- [ ] Create Tauri + React + Tailwind skeleton.
- [ ] Configure menu bar/tray behavior if available in selected Tauri setup.
- [ ] Build compact control popover.
- [ ] Add connection status display.
- [ ] Add power, mute, play/pause buttons.
- [ ] Add volume slider plus step buttons.
- [ ] Add input selector.
- [ ] Add preset row placeholder.
- [ ] Add settings view for service URL.
- [ ] Connect to mock service contract.
- [ ] Handle loading, disconnected, command pending, and error states.

## Acceptance Criteria

- App can run against a mock/local service URL.
- UI is usable without now-playing metadata.
- Controls call documented service endpoints.
- WebSocket state updates update UI.
- Text and controls fit inside compact popover dimensions.

## Return Format

Return:

- Files changed
- Screenshots if available
- Commands run
- Missing service contract assumptions

