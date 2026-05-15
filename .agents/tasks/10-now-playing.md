# Task 10: Now Playing Metadata

Status: Completed for MVP.

Completed:

- Metadata fields in shared state.
- Parsing for `NTI`, `NAT`, `NAL`, `NST`, `NTM`, and `NTR`.
- Reducer tests.
- Desktop now-playing compact section.
- Empty metadata fallback.
- Unknown metadata/list events are logged for future analysis.

Real-device result:

- CR-N775 returned blank title/artist/album while stopped on NET, and the UI handled it safely.
- CR-N775 emitted `NJA` album art URL and `NLS` NET list events; these are not displayed in the MVP.

## Goal

Add metadata parsing and UI display for title, artist, album, playback state, and time where supported by CR-N775.

## Ownership

You own:

- Metadata command constants/reducers in `packages/shared/**` and `packages/service/**`
- Metadata display components in `apps/desktop/**`
- Tests/fixtures for metadata events

Coordinate with protocol/service owners. Do not rewrite connection management.

## Commands To Consider

- `NTI`: title
- `NAT`: artist
- `NAL`: album
- `NST`: playback status
- `NTM`: time
- `NTR`: track
- `NJA`: album art, later only

## Work Items

- [x] Add metadata fields to shared state.
- [x] Add metadata query/update handling.
- [x] Add reducer tests.
- [x] Add desktop now-playing compact section.
- [x] Add fallback UI when metadata is missing.
- [x] Log unsupported/unknown metadata events for real-device verification.

## Follow-Up Work

- Only add album art after confirming `NJA` behavior across sources.
- Avoid treating empty metadata as an error; it is a normal CR-N775 state.

## Acceptance Criteria

- App works when all metadata is empty.
- Metadata updates do not break core controls.
- Album art is not required for this task.

## Return Format

Return:

- Files changed
- Metadata commands supported
- Tests run
- Real-device verification still needed
