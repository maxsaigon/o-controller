# Task 06: Presets And Shortcuts

Status: Completed for code track. Native shortcut behavior remains in the UI/Tauri track.

Completed:

- Preset schema in shared types.
- Default presets in service.
- `POST /presets/:id/run`.
- Desktop preset buttons.
- Settings UI includes shortcut reference.
- Preset command order, delay, uniqueness, and error tests in `packages/service/src/presets.test.ts`.

Deferred to UI/Tauri track:

- Native global shortcuts.
- Shortcut conflict handling.

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
- [x] Defer global shortcuts for volume, mute, play/pause, and popover to the native Tauri shell.
- [x] Add settings UI for service URL and shortcuts if feasible.
- [x] Add tests for preset execution order.

## Follow-Up Work

- Wait for the native Tauri shell, then register global shortcuts there.
- Keep the UI label `Standby` for the `stop` preset to make the power-off behavior explicit.

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
