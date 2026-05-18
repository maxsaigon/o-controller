# Task: Home Now Playing And Volume Completion

## Goal

Hoan thien trang Home va Volume de ung dung macOS co the lam dung luong chinh:

```text
Install app -> set receiver IP -> control N775 -> see current music -> adjust volume
```

Home phai lay va hien thi metadata bai nhac dang phat tu receiver/service, theo huong Onkyo Hi-res reference trong `/Users/daibui/Downloads/IMG_4858.PNG`: artwork lon, progress, title, artist/album/format, playback controls, volume accessible ro rang.

Khong mo rong sang Music Server browser, NAS/USB file browsing, queue management, streaming service catalog, lyrics, hoac mobile app clone.

## References

- `/Users/daibui/Downloads/IMG_4858.PNG`
- `/Users/daibui/Desktop/Screenshot 2026-05-18 at 09.41.27.png`
- `/Users/daibui/Desktop/Screenshot 2026-05-18 at 09.42.34.png`
- `docs/uiux-onkyo-hires-reference.md`
- `docs/uiux-spec.md`
- `docs/protocol-notes.md`

## Current State

Relevant files:

- `packages/shared/src/index.ts`
- `packages/eiscp/src/index.ts`
- `packages/service/src/receiver-client.ts`
- `packages/service/src/state-store.ts`
- `packages/service/src/server.ts`
- `apps/desktop/src/ui/useOControlApi.ts`
- `apps/desktop/src/app-shell/DesktopShell.tsx`
- `apps/desktop/src/components/NowPlaying.tsx`
- `apps/desktop/src/components/PlaybackControls.tsx`
- `apps/desktop/src/components/VolumeControl.tsx`
- `apps/desktop/src/components/CommandBar.tsx`
- `apps/desktop/src/styles/global.css`

What already exists:

- Service exposes `/state` and `/events`.
- `StateStore` already parses:
  - `NTI` title.
  - `NAT` artist.
  - `NAL` album.
  - `NST` playback status.
  - `NTM` current/total time.
  - `NTR` track number.
  - `MVL` volume.
  - `AMT` mute.
- Desktop Home already renders a centered now-playing area and playback controls.
- Volume rail opens a compact volume sheet with slider, +/- and mute.

Known gaps:

- `queryInitialState()` does not query `NTMQSTN` and `NTRQSTN`, even though parser supports them.
- There is no first-class field for cover artwork.
- There is no first-class field for audio format, sample rate, bit depth, repeat, or shuffle.
- Playback progress is text-only and not a real progress bar.
- Mock mode does not simulate time/track/format/cover enough for UI QA.
- Volume slider only commits on pointer up or Enter; keyboard/change edge cases need tightening.
- Volume panel currently competes with Home vertical space and can create awkward layout pressure.

## Product Requirements

### Home

Home must show the current music state from the active receiver/service:

- Receiver/app title and current input/source.
- Connection state.
- Artwork area:
  - use real artwork when the service can provide it,
  - otherwise use a polished placeholder, never a broken image.
- Playback status: playing, paused, stopped, idle/offline.
- Title.
- Artist.
- Album.
- Audio detail line when available: examples `FLAC / 48kHz / 24bit`, `MP3 / 44.1kHz`, or hidden when unknown.
- Progress bar with elapsed and total time.
- Playback controls: previous, play/pause, stop, next.
- Bottom command rail remains available.

### Volume

Volume must be fast, predictable, and synced with receiver state:

- Current volume number is always visible in the bottom rail.
- Opening Volume should not break Home layout or introduce horizontal scroll.
- +/- buttons send one-step commands and update from receiver response.
- Slider supports drag, click, keyboard, and final commit without flooding receiver.
- Mute toggle does not move the slider or hide the current volume.
- If the physical receiver knob changes volume, UI updates through WebSocket state.
- Pending/error state is visible but compact.

## Data Contract

Extend `NowPlayingMeta` conservatively.

```ts
export interface NowPlayingMeta {
  title: string;
  artist: string;
  album: string;
  currentTime: string;
  totalTime: string;
  trackNumber: string;
  coverArtUrl?: string;
  format?: string;
  sampleRate?: string;
  bitDepth?: string;
  repeat?: 'off' | 'one' | 'all' | 'unknown';
  shuffle?: 'off' | 'on' | 'unknown';
}
```

Rules:

- Empty strings mean unknown for existing fields.
- Optional fields mean unknown/unavailable.
- UI must not fake metadata as if it came from the receiver.
- Mock mode may provide deterministic sample metadata for QA, clearly isolated to mock mode.

## Metadata And Cover Strategy

### Phase 1: Reliable Existing Metadata

Use commands already documented and partially implemented:

- `NTIQSTN` title.
- `NATQSTN` artist.
- `NALQSTN` album.
- `NSTQSTN` playback status.
- `NTMQSTN` elapsed/total time.
- `NTRQSTN` track number.

Implementation:

- Add `TIME_QUERY` and `TRACK_QUERY` to initial state query.
- Add a bounded refresh loop for time/progress while playing, for example every 1-2 seconds.
- Re-query metadata after input changes and playback transitions.
- Preserve unsolicited receiver events as the source of truth when they arrive.

### Phase 2: Audio Format Fields

Investigate the CR-N775 eISCP responses available for current source.

Acceptable first pass:

- If receiver exposes format/sample/bit depth through an eISCP command, parse and expose it.
- If not verified, keep fields optional and hidden in UI.
- Do not hardcode `FLAC / 48kHz / 24bit` except in mock mode.

### Phase 3: Cover Artwork

Cover art is not guaranteed by the current service.

Preferred order:

1. Verify whether CR-N775 exposes artwork over eISCP or a local HTTP endpoint for Network/Music Server playback.
2. If a reliable local artwork URL/blob is available, expose it as `coverArtUrl`.
3. If not available, keep a high-quality placeholder that matches the reference and document the limitation.

Do not add internet album-art search in this task. It adds privacy, rate-limit, matching, and licensing complexity that is not needed for controlling N775.

## Home UI Plan

### Layout

- Keep one primary Home surface; do not add a landing page.
- Make artwork the visual anchor, similar to the reference, but sized to fit the current macOS popover.
- Put progress directly under artwork.
- Put title and metadata under progress.
- Keep playback controls under metadata.
- Keep bottom rail fixed height.
- Avoid document/body scroll and horizontal scroll.

### States

Implement and visually verify:

- Connected + playing + full metadata.
- Connected + playing + missing artwork.
- Connected + playing + missing artist/album.
- Connected + paused.
- Connected + stopped/no track.
- Receiver disconnected/service offline.
- Long Vietnamese title/artist/album text.

### Text Rules

- Title may wrap to two lines max.
- Artist/album/format lines truncate gracefully.
- No text overlaps controls.
- No viewport-width font scaling.

## Volume UI Plan

### Interaction

- Rail volume button opens a compact overlay/sheet.
- Keep the sheet visually attached to the rail, but it must not cover essential playback controls in a confusing way.
- Slider draft state can move freely while dragging.
- Commit only on:
  - pointer release,
  - keyboard Enter,
  - blur after keyboard adjustment,
  - +/- button click.
- Clamp values to `0-100`.
- Disable controls only when receiver is unavailable or command is pending.

### Sync

- After sending a volume command, wait for receiver `MVL` response when available.
- If no response arrives after a short timeout, refresh `MVLQSTN`.
- If command fails, restore last known service state and show a compact inline error.
- Physical knob updates must update rail label, slider, and volume number.

### Mute

- Mute state is independent from volume value.
- Rail label may show `Muted`, but expanded sheet should still show last volume number.
- Mute/unmute should refresh `AMTQSTN` if no response arrives quickly.

## Implementation Phases

### Phase 1: Service Metadata Completeness

- [x] Extend shared `NowPlayingMeta` with optional cover/format fields.
- [x] Add `TIME_QUERY` and `TRACK_QUERY` to `queryInitialState()`.
- [x] Add playing-state refresh for `NTMQSTN`.
- [x] Re-query metadata after input and playback changes.
- [x] Expand mock responses for `NTM`, `NTR`, and long realistic metadata.
- [x] Add tests for time/track initial query and state updates.

### Phase 2: Cover And Format Investigation

- [x] Add a short research note under `docs/` describing what CR-N775 actually returns for artwork/format.
- [x] If real artwork source exists, add service support for `coverArtUrl`.
- [x] If no reliable artwork source exists, document placeholder fallback as intentional.
- [x] If real format/sample/bit-depth source exists, parse it into optional metadata fields.
- [x] Keep UI hidden/fallback for unavailable fields.

### Phase 3: Home UI Completion

- [x] Update `NowPlaying` to render artwork image with placeholder fallback.
- [x] Add progress bar using `currentTime` and `totalTime`.
- [x] Add title, artist, album, and audio detail line matching the reference hierarchy.
- [x] Improve empty/offline/paused/stopped states.
- [x] Verify long Vietnamese metadata does not overlap or force scroll.
- [x] Keep playback controls visible without opening panels.

### Phase 4: Volume Completion

- [x] Make volume overlay/sheet compact and stable at popover width.
- [x] Ensure no horizontal scroll and no unwanted document scroll.
- [x] Improve slider commit behavior for pointer, keyboard, and blur.
- [x] Add fallback refresh after volume/mute command if receiver response is delayed.
- [x] Ensure rail volume label updates from WebSocket and physical knob changes.
- [x] Keep mute state visually clear without hiding numeric volume.

### Phase 5: Verification

- [x] Run `git diff --check`.
- [x] Run `npm test`.
- [x] Run `npm run test:integration`.
- [x] Run `npm run build -w @o-control/desktop`.
- [x] Run sidecar mock smoke test.
- [x] Browser/Tauri visual QA for Home:
  - [x] full metadata,
  - [x] no artwork,
  - [x] long Vietnamese metadata,
  - [x] paused/stopped/offline.
- [x] Browser/Tauri visual QA for Volume:
  - [x] open/close sheet,
  - [x] slider drag,
  - [x] +/- buttons,
  - [x] mute toggle,
  - [x] no horizontal/vertical overflow.
- [ ] Verify with real CR-N775 when available:
  - [ ] title/artist/album,
  - [ ] time/progress,
  - [ ] track number,
  - [ ] volume physical knob sync,
  - [ ] cover/format availability or confirmed unavailable.

## Acceptance Criteria

Home is complete when:

- [x] Current title, artist, album, playback status, elapsed/total time display from real service state.
- [x] Artwork slot shows real cover when available, otherwise a polished placeholder.
- [x] Audio format line appears only when real data is available.
- [x] Progress bar reflects current/total time and does not break when time is unknown.
- [x] Playback buttons remain usable and visually stable.
- [x] UI resembles the Onkyo Hi-res player hierarchy without copying mobile-only chrome.

Volume is complete when:

- [x] Rail always shows current volume or muted state.
- [x] Expanded volume control supports step, slider, keyboard, and mute.
- [x] UI remains synced with receiver WebSocket events.
- [x] Delayed command responses are handled by refresh, not stale UI.
- [x] No horizontal scrollbar or awkward popover scroll is introduced.

## Explicit Non-Goals

- Do not build NAS/USB browser screens.
- Do not add streaming service browsing.
- Do not fetch cover art from internet APIs.
- Do not implement queue/playlist management.
- Do not redesign Settings in this task except for layout conflicts caused by Home/Volume.
- Do not rewrite the service architecture unless needed for metadata correctness.

## Notes For Agent

- Treat receiver/service state as source of truth.
- Prefer small service contract extensions over ad hoc UI-only data.
- Keep mock mode good enough to QA the Home screen without a real receiver.
- Do not mark cover/format complete until tested or explicitly documented as unavailable.
- Preserve the core README workflow: setup receiver IP, connect, control N775.
