# Task 09: Raycast Extension

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

- [ ] Create Raycast extension skeleton.
- [ ] Add service URL preference.
- [ ] Implement command wrappers around service API.
- [ ] Add state display.
- [ ] Handle service unreachable errors.
- [ ] Document local development.

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

