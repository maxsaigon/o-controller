# Task 11: NAS/USB Browser Spike

Status: Completed with recommendation to postpone.

Completed:

- Spike documented in `docs/nas-usb-browser-spike.md`.
- Recommendation: postpone.
- Real receiver emitted `NLS` NET list events and `NJA` album art URL, confirming this area is technically reachable but outside MVP scope.

## Goal

Investigate whether browsing NAS/USB through eISCP is worth building. This is a spike, not a production feature.

## Ownership

You own:

- `docs/nas-usb-browser-spike.md`
- Optional isolated spike under `spikes/nas-usb-browser/**`

Do not edit production service/UI unless explicitly approved.

## Work Items

- [x] Review how reference projects handle NET/USB list browsing.
- [x] Identify commands around `NLS`, `NLA`, navigation, selection, and list updates.
- [x] Define what real CR-N775 logs are needed.
- [x] Build a small isolated parser/prototype only if useful.
- [x] Evaluate UX cost versus benefit.

## Follow-Up Work

- Do not start production NAS/USB browsing until there are real logs for navigation, pagination, selection, Unicode names, and different media servers.
- If revived, keep the first implementation behind an experimental/debug UI, not the primary desktop companion.

## Acceptance Criteria

- Clear recommendation: build, postpone, or skip.
- Unknowns are explicit.
- No production code is changed.

## Return Format

Return:

- Files changed
- Recommendation
- Required real-device tests
- Risks
