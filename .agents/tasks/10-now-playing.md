# Task 10: Now Playing Metadata

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

- [ ] Add metadata fields to shared state.
- [ ] Add metadata query/update handling.
- [ ] Add reducer tests.
- [ ] Add desktop now-playing compact section.
- [ ] Add fallback UI when metadata is missing.
- [ ] Log unsupported/unknown metadata events for real-device verification.

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

