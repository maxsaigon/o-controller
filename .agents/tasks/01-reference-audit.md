# Task 01: Reference Audit

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

- [ ] Summarize what each repo solves.
- [ ] Identify features O-Control should copy conceptually, not code.
- [ ] Document license concerns, especially GPL-3.0 in `mkulesh/onpc`.
- [ ] Extract the core command groups needed for MVP.
- [ ] Document eISCP packet format and payload format.
- [ ] Document expected commands for power, volume, mute, input, playback, metadata.
- [ ] Identify behavior that must be verified on real CR-N775 hardware.
- [ ] Produce a build/buy decision matrix: use existing app, wrapper, or custom O-Control.

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

