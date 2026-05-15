# Task 04: macOS Desktop UI Shell

Status: Implemented. Native build and sizing verification require Rust/Cargo, which is not installed in this environment.

Completed:

- React/Vite desktop companion UI in `apps/desktop`.
- Compact control surface with status, power, mute, volume, playback, input, presets, now playing, and service settings.
- Uses service API and WebSocket only; no direct eISCP logic.
- Verified in browser against mock mode and real CR-N775 service.
- QA notes and screenshot exist in `docs/uiux-review`.
- Native Tauri shell source under `apps/desktop/src-tauri`.
- macOS tray/menu-bar entry and close-to-tray behavior.
- Native global shortcut registration path through `@tauri-apps/plugin-global-shortcut`.

Not completed:

- Native binary build and runtime sizing QA on a Rust/Cargo-equipped macOS machine.
- Tailwind setup was intentionally skipped; CSS is currently plain CSS.

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

- [x] Create Tauri + React shell skeleton.
- [x] Configure menu bar/tray behavior if available in selected Tauri setup.
- [x] Build compact control popover.
- [x] Add connection status display.
- [x] Add power, mute, play/pause buttons.
- [x] Add volume slider plus step buttons.
- [x] Add input selector.
- [x] Add preset row placeholder.
- [x] Add settings view for service URL.
- [x] Connect to mock service contract.
- [x] Handle loading, disconnected, command pending, and error states.

## Follow-Up Work

- Verify native popover sizing, dark mode, keyboard focus, and screen-reader labels.
- Install Rust/Cargo and run `npm run tauri:build -w @o-control/desktop`.

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
