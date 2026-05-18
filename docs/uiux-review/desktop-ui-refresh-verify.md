# Desktop UI Refresh Verification

Date: 2026-05-15

## Scope

Verified the Onkyo Hi-res inspired desktop UI refresh implemented in:

- `apps/desktop/src/app-shell/DesktopShell.tsx`
- `apps/desktop/src/components/*`
- `apps/desktop/src/styles/global.css`

This verification covers the UI refresh only. The worktree also contains unrelated or parallel changes in Tauri packaging/service files that were not reviewed here.

## Commands

```bash
npm run build -w @o-control/desktop
npm test
```

Results:

- Desktop build passed.
- Full workspace test suite passed: 78 tests passing.

## Browser Preview

Preview command:

```bash
npm run dev -w @o-control/desktop -- --host 127.0.0.1
```

The preferred port `5173` was already in use, so Vite served the desktop preview at:

```text
http://127.0.0.1:5174/
```

Service state used for preview:

```json
{
  "connected": true,
  "power": "on",
  "input": "net",
  "volume": 15,
  "muted": false,
  "playback": "stopped"
}
```

## Visual Checks

- Main player shell rendered with dark Onkyo-inspired surface, centered receiver/source hierarchy, power icon, artwork placeholder, playback row, and bottom command rail.
- Input sheet opened from the rail and showed a two-column grid with selected Network state highlighted.
- Volume sheet opened from the rail and showed volume number, slider, step buttons, and mute control.
- Preset sheet opened from the rail and preserved `Standby` labeling for the stop preset.
- Settings view rendered in the dark visual system with service URL and shortcut status.
- No obvious text overlap or layout overflow was observed at the current browser preview size.

## Notes

- Browser tooling emitted external Statsig/Cloudflare telemetry warnings unrelated to the local app render.
- The service on `127.0.0.1:8787` was already running in non-mock mode, so a new mock service was not started.
- Shortcut `Cmd/Ctrl Shift O` is correctly defined with the letter `O`; in small screenshots it can look close to `0`.

