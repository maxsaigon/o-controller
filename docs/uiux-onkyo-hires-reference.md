# Onkyo Hi-res UI Reference Notes

## Source Images

Reference screenshots provided by the user:

- `/Users/daibui/Downloads/IMG_4835.PNG`
- `/Users/daibui/Downloads/IMG_4837.PNG`
- `/Users/daibui/Downloads/IMG_4838.PNG`
- `/Users/daibui/Downloads/IMG_4839.PNG`

These are visual and interaction references for the O-Control macOS desktop companion. They should guide tone, hierarchy, and control grouping, but the desktop app should not become a direct mobile clone.

## What To Borrow

### Overall Tone

- Dark, quiet, hi-fi remote feel.
- Low-contrast gray typography with blue accent for active/power/selected states.
- Thin outline icons instead of heavy filled controls.
- Minimal explanatory text.
- Large breathing room around primary media state.

### Player Screen

Observed pattern:

- Top area: home icon, centered receiver/app title, power icon.
- Source label sits under the title.
- Large album artwork.
- Progress line with elapsed/total time.
- Track title and artist/album/format text.
- Playback controls use thin icons.
- Bottom rail contains input, volume, equalizer/settings, and more.

Desktop adaptation:

- Use a compact player-first popover.
- Keep power and receiver/input context in the header.
- Put now-playing content in the center.
- Put playback controls directly under metadata.
- Keep volume and input in a bottom command rail or compact control band.

### Network Source Grid

Observed pattern:

- Source picker uses a sparse grid on a dark background.
- Labels are large and human-readable.
- Service/source logos are secondary to source identity.

Desktop adaptation:

- Input picker should open as a sheet/overlay.
- Use a two-column icon grid: CD, Network, USB, Bluetooth, Line, Tuner.
- Selected input gets blue highlight treatment.
- Do not show unavailable streaming services unless the service actually supports selecting them.

### Music Server List

Observed pattern:

- Folder list is plain and readable.
- Thin separators.
- Folder icon on the left, action/plus on the right.
- Bottom mini-player remains available.

Desktop adaptation:

- This pattern is useful later for NAS/USB browsing.
- Do not implement as part of the first UI refresh unless the service already exposes real list data.
- If implemented later, use the same dark list with thin separators and persistent bottom controls.

### Input Overlay

Observed pattern:

- Dark rounded overlay.
- Centered title.
- Gear/settings affordance.
- Two-column input grid.
- Selected input has a blue outline.
- Pagination dots are present for more inputs.

Desktop adaptation:

- Use a popover sheet instead of a full-screen modal.
- No pagination unless the input list exceeds the first grid.
- Gear can route to settings if needed.

## What Not To Copy

- iPhone status bar.
- Exact mobile proportions.
- Phone bottom safe-area behavior.
- Large source/browser screens that exceed the macOS popover use case.
- Streaming service logos unless legally/assets-wise handled and technically backed by receiver state.
- Fake Music Server/NAS browsing before protocol support is implemented.

## Proposed Desktop Visual System

Palette:

- Main surface: `#101112` to `#171717`.
- Header surface: `#74746f` inspired by the screenshot top band, toned down for desktop.
- Lower rail/warm band: dark brown around `#6b3a24` or `#7a4729`.
- Text primary: `#e5e2dd`.
- Text secondary: `#aaa7a2`.
- Separator: `rgba(229, 226, 221, 0.18)`.
- Accent blue: `#45aaff`.

Typography:

- Use system font stack.
- Lighter weights than the current utility UI.
- Header/source labels can be centered.
- Buttons should prefer icons with tooltips over text-heavy controls.

Layout:

- `desktop-frame` can stay as preview scaffolding.
- `.popover` should become a dark player shell.
- Header: home/settings affordance, centered receiver/source stack, power icon.
- Content: now-playing/artwork area, progress/metadata, playback row.
- Bottom rail: input, volume, settings/equalizer, more.
- Input picker: overlay/sheet grid.

## Product Boundaries

In scope for the UI refresh:

- Visual redesign of current desktop popover.
- Player-first now-playing layout.
- Bottom command rail.
- Input picker overlay/grid.
- Better volume affordance that matches the reference.
- Empty/offline states in the same visual language.

Out of scope for this UI refresh:

- Real album art retrieval unless the service already exposes artwork.
- Full Music Server/NAS browser.
- Streaming service browsing.
- macOS Control Center integration.
- Native Swift rewrite.
