# Task: Refresh Desktop UI Using Onkyo Hi-res Reference

## Goal

Redesign the existing Tauri desktop companion UI so it follows the visual and interaction direction of the supplied Onkyo Hi-res mobile screenshots while remaining a compact macOS menu bar app.

The result should feel like a premium hi-fi remote: dark, calm, thin-lined, player-first, and quick to operate.

## References

Read first:

- `docs/uiux-onkyo-hires-reference.md`
- `docs/uiux-plan.md`
- `docs/uiux-spec.md`

Source screenshots:

- `/Users/daibui/Downloads/IMG_4835.PNG`
- `/Users/daibui/Downloads/IMG_4837.PNG`
- `/Users/daibui/Downloads/IMG_4838.PNG`
- `/Users/daibui/Downloads/IMG_4839.PNG`

## Current Implementation

Key files:

- `apps/desktop/src/app-shell/DesktopShell.tsx`
- `apps/desktop/src/components/StatusHeader.tsx`
- `apps/desktop/src/components/CommandBar.tsx`
- `apps/desktop/src/components/VolumeControl.tsx`
- `apps/desktop/src/components/PlaybackControls.tsx`
- `apps/desktop/src/components/InputSelector.tsx`
- `apps/desktop/src/components/PresetStrip.tsx`
- `apps/desktop/src/components/NowPlaying.tsx`
- `apps/desktop/src/components/ServiceSettings.tsx`
- `apps/desktop/src/styles/global.css`

Keep the existing API hook and command wiring unless a small structural change is required:

- `apps/desktop/src/ui/useOControlApi.ts`

## Required UX Changes

### 1. Player-First Shell

- Replace the current generic utility/card layout with a dark player-style shell.
- Header should resemble the reference hierarchy:
  - left icon affordance for home/back/settings context,
  - centered `O-Control` or receiver name,
  - source/input label underneath,
  - right-side power icon.
- Keep connection state visible, but make it compact and integrated.

### 2. Now Playing Center

- Promote `NowPlaying` into the main center region.
- Show title, artist, album, playback status, and time if available.
- Prepare an artwork slot:
  - if real artwork is unavailable, render a tasteful placeholder,
  - do not leave a broken image or empty square.
- Long metadata must truncate/wrap cleanly.

### 3. Playback Row

- Use thin icon buttons similar to the reference.
- Include previous, play/pause, next, and stop where appropriate.
- Avoid large labeled buttons in the normal player view.
- Tooltips/accessibility labels must preserve clarity.

### 4. Bottom Command Rail

- Add a persistent bottom rail inspired by the screenshots:
  - input/source,
  - volume,
  - settings/equalizer,
  - more or presets.
- This rail should be easy to hit in a small popover and should not shift height across states.

### 5. Input Picker Overlay

- Replace the always-visible segmented input selector with a sheet/overlay opened from the bottom rail.
- Use a two-column icon grid with labels:
  - CD,
  - Network,
  - USB,
  - Bluetooth,
  - Line,
  - Tuner.
- Highlight the selected input with blue treatment.
- Show pending state only on the selected target.
- Keep keyboard and screen-reader accessibility.

### 6. Volume Interaction

- Keep volume quickly accessible from the rail.
- Provide a compact expanded volume control, either inline above the rail or as a small overlay.
- Volume number should remain legible.
- Mute state should be visually distinct without moving layout.

### 7. Presets

- Preserve preset functionality.
- Do not let presets dominate the primary player screen.
- Put presets behind a rail action, a compact row, or a secondary sheet.
- `stop` should continue to display as `Standby` if it powers down the receiver.

### 8. Settings

- Settings can keep the current secondary view behavior.
- Restyle it into the same dark visual system.
- Service URL and shortcut status remain required.

## Explicit Non-Goals

- Do not implement real Music Server/NAS browsing in this task.
- Do not add fake streaming service tiles unless backed by actual app behavior.
- Do not implement album art protocol fetching unless it is already exposed by the service.
- Do not rewrite the app in Swift.
- Do not add macOS Control Center/WidgetKit controls.

## Implementation Guidance

- Prefer adapting existing components instead of replacing the whole app tree.
- Use `lucide-react` icons where they match the desired thin-line language.
- Keep CSS scoped to current class names or introduce clear new class names in `global.css`.
- Avoid nested cards and marketing-style layout.
- Do not make text scale with viewport width.
- Ensure text and controls fit at the Tauri window size currently configured in `apps/desktop/src-tauri/tauri.conf.json`.
- Maintain browser preview compatibility.

## Verification

Run:

```bash
npm run build -w @o-control/desktop
```

If dependencies/tooling allow, also run:

```bash
npm test
```

Visual QA:

- Open the desktop UI in browser preview against mock service.
- Capture screenshots for:
  - connected + metadata,
  - connected + empty metadata,
  - service offline,
  - input picker open,
  - settings view.
- Save review notes under `docs/uiux-review/`.

## Acceptance Criteria

- The app clearly reflects the Onkyo Hi-res reference: dark shell, thin icon controls, centered receiver/source hierarchy, bottom command rail, and input grid overlay.
- Existing controls still work: power, mute, volume, playback, input switching, presets, settings.
- The UI remains compact and usable in the macOS popover window.
- Long text does not overlap controls.
- Offline/error states remain understandable.
- Build passes or failures are documented with exact command output summary.
