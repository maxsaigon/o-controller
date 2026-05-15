# Task 11: NAS/USB Browser Spike

## Goal

Investigate whether browsing NAS/USB through eISCP is worth building. This is a spike, not a production feature.

## Ownership

You own:

- `docs/nas-usb-browser-spike.md`
- Optional isolated spike under `spikes/nas-usb-browser/**`

Do not edit production service/UI unless explicitly approved.

## Work Items

- [ ] Review how reference projects handle NET/USB list browsing.
- [ ] Identify commands around `NLS`, `NLA`, navigation, selection, and list updates.
- [ ] Define what real CR-N775 logs are needed.
- [ ] Build a small isolated parser/prototype only if useful.
- [ ] Evaluate UX cost versus benefit.

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

