# Task 06: Presets And Shortcuts

## Goal

Add user workflow features on top of the core service and desktop app.

## Ownership

You own:

- Preset schema and logic in `packages/shared/**` and `packages/service/**`
- Shortcut wiring in `apps/desktop/**`
- Related docs

Coordinate carefully with service and desktop agents. Do not rewrite their architecture.

## Work Items

- [ ] Define `PresetDefinition` schema.
- [ ] Add default presets: `Work Jazz`, `Focus Quiet`, `Stop`.
- [ ] Add service endpoint for running presets.
- [ ] Add desktop preset buttons.
- [ ] Add global shortcuts for volume, mute, play/pause, popover.
- [ ] Add settings UI for service URL and shortcuts if feasible.
- [ ] Add tests for preset execution order.

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

