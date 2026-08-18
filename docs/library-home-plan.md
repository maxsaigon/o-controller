# Library Home Implementation Plan

## Goal

Create a visual, useful Home destination for the real MusicServer library. Artwork is the primary visual material; playback continues to use the existing DLNA queue and persistent player.

## Product decisions

- Home is the first-class sidebar destination and the startup view.
- Data comes from the active/first discovered DLNA server. No demo albums are rendered.
- Home lazily browses the server root, then the Albums and Genre/Genres containers when available.
- Featured album is stable for the current day and selected from albums that have artwork when possible.
- Genre cards come from the MusicServer genre container. Selecting a genre deep-links directly to that collection in Library.
- `Recently added` is not claimed until the server provides trustworthy date metadata. The initial shelf is named `Explore your library`.
- Album playback browses that album, builds the real track playlist, then delegates to `/dlna/play`.

## Page structure

1. Intro heading and library count.
2. Featured album hero with artwork, Play Album and Open Album actions.
3. Explore your library album shelf.
4. Browse by Genre cards.
5. Deep-linked album/genre detail in Library.
6. Persistent mini-player.

## Interaction and motion

- Artwork cards use lazy loading and async decoding through the existing artwork proxy.
- Hero and cards use short fade/translate transitions; hover elevation is restrained.
- Motion is disabled when `prefers-reduced-motion` is enabled.
- Loading skeletons keep the layout stable while DLNA requests finish.

## Data and failure states

- Reuse `/dlna/servers`, `/dlna/browse`, `/dlna/artwork`, and `/dlna/play`.
- Prefer the server saved by the existing Library browser, otherwise use the first discovered server.
- Missing Albums or Genres containers produce honest empty states.
- A failed request shows an inline error and Retry without removing the rest of the app.
- Missing artwork uses a deterministic gradient placeholder.

## Verification

- Component tests cover loading real containers, genre selection, album playback, empty data, and retry.
- Desktop shell tests cover Home navigation and persistent mini-player behavior.
- Desktop tests, workspace typecheck, and desktop production build must pass.
- Layout must remain usable at 920×640, 1180×760, and 1440×900.
