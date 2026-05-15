# Task 09: Raycast Extension

Status: Completed for local use.

Completed:

- Raycast extension skeleton in `apps/raycast`.
- Service URL preference.
- Power, volume up/down/set, mute, input switch, preset runner, and status viewer.
- Readable service-unreachable errors.
- Build and source lint pass.

Not completed:

- Publish-ready icon asset.
- Valid public Raycast author metadata.

## Goal

Create an optional Raycast extension for fast keyboard-first control.

## Ownership

You own:

- `apps/raycast/**`
- Raycast-specific docs

Do not edit service internals.

## Commands

- `Onkyo: Power Toggle`
- `Onkyo: Volume Up`
- `Onkyo: Volume Down`
- `Onkyo: Set Volume`
- `Onkyo: Switch Input`
- `Onkyo: Work Jazz`
- `Onkyo: Stop`

## Work Items

- [x] Create Raycast extension skeleton.
- [x] Add service URL preference.
- [x] Implement command wrappers around service API.
- [x] Add state display.
- [x] Handle service unreachable errors.
- [x] Document local development.

## Follow-Up Work

- Add a real `assets/command-icon.png`.
- Replace placeholder `author` with a valid Raycast account handle if publishing.
- Run `ray lint` publish validation only after icon and author metadata are ready.

## Acceptance Criteria

- Commands work against mock/local service.
- Errors are readable in Raycast.
- Extension does not duplicate protocol logic.

## Return Format

Return:

- Files changed
- Commands implemented
- How to run/test
- Missing API assumptions
