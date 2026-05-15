# Task 06: Presets And Shortcuts

Status: Completed.

Completed:

- Preset schema in shared types.
- Default presets in service.
- `POST /presets/:id/run`.
- Desktop preset buttons.
- Settings UI includes shortcut reference.
- Preset command order, delay, uniqueness, and error tests in `packages/service/src/presets.test.ts`.
- Native global shortcut registration path in the Tauri shell.
- Shortcut conflict/unavailable state reporting in Settings.

## Goal

Add user workflow features on top of the core service and desktop app.

## Ownership

You own:

- Preset schema and logic in `packages/shared/**` and `packages/service/**`
- Shortcut wiring in `apps/desktop/**`
- Related docs

Coordinate carefully with service and desktop agents. Do not rewrite their architecture.

## Work Items

- [x] Define `PresetDefinition` schema.
- [x] Add default presets: `Work Jazz`, `Focus Quiet`, `Stop`.
- [x] Add service endpoint for running presets.
- [x] Add desktop preset buttons.
- [x] Add global shortcuts for volume, mute, play/pause, and popover to the native Tauri shell.
- [x] Add settings UI for service URL and shortcuts if feasible.
- [x] Add tests for preset execution order.

## Follow-Up Work

- Keep the UI label `Standby` for the `stop` preset to make the power-off behavior explicit.
- Verify actual macOS shortcut registration after Rust/Cargo is installed and the Tauri shell can run.

## Acceptance Criteria

- Presets call existing command endpoints or command controller.
- Shortcut failures do not crash the app.
- Dangerous preset actions like standby are explicit in label/behavior.

## Return Format

Return:

- Files changed
- Presets added
- Shortcuts added
- Tests run
