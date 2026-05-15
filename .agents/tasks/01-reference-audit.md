# Task 01: Reference Audit

Status: Completed for MVP.

Completed outputs:

- `docs/reference-audit.md`
- `docs/protocol-notes.md`
- `docs/feature-scope.md`

Real-device updates:

- CR-N775 at `192.168.1.104` accepts eISCP TCP on port `60128`.
- Confirmed readback for power, volume, mute, input, playback, and empty now-playing metadata.
- Observed `NJA` album art URL and `NLS` NET list events. These remain reference material for a future NAS/USB/browser task, not MVP scope.

## Goal

Create the technical reference notes that all other agents can rely on. The output should reduce guesswork around eISCP, feature scope, and behavior already solved by existing projects.

## Ownership

You own:

- `docs/reference-audit.md`
- `docs/protocol-notes.md`
- `docs/feature-scope.md`

Do not edit application code.

## References To Inspect

- `mkulesh/onpc`
- `miracle2k/onkyo-eiscp`
- `jhesch/integra`
- `tillbaks/node-eiscp`
- `ava-brn/lib-eiscp`
- `estbeetoo/node-red-contrib-eiscp`

## Work Items

- [x] Summarize what each repo solves.
- [x] Identify features O-Control should copy conceptually, not code.
- [x] Document license concerns, especially GPL-3.0 in `mkulesh/onpc`.
- [x] Extract the core command groups needed for MVP.
- [x] Document eISCP packet format and payload format.
- [x] Document expected commands for power, volume, mute, input, playback, metadata.
- [x] Identify behavior that must be verified on real CR-N775 hardware.
- [x] Produce a build/buy decision matrix: use existing app, wrapper, or custom O-Control.

## Follow-Up Work

- Keep adding real CR-N775 packet logs to docs when testing new sources or firmware behavior.
- Confirm exact behavior of NAS/USB list navigation before implementing any browser UI.

## Acceptance Criteria

- Docs are specific enough that protocol/service agents can implement without re-reading every repo.
- Every borrowed idea is described as behavior, not copied code.
- Unknowns are clearly marked as "Needs CR-N775 verification".

## Return Format

Return:

- Files changed
- Key findings
- Open questions
- Any commands run
