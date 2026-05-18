# O-Control UI/UX Specification

## 1. App Shell

The first production UI is a macOS menu bar popover.

Default popover:

```text
+--------------------------------------+
| [Home]        O-Control        [Power]|
|               CR-N775                 |
|                 NET                   |
+--------------------------------------+
|                                      |
|        Now playing / artwork         |
|                                      |
|        Title                         |
|        Artist / Album / Format       |
|                                      |
|   [Repeat] [Prev] [Play] [Next]      |
+--------------------------------------+
| [Input]      [Volume 26]   [Settings]|
+--------------------------------------+
```

Popover rules:

- Width should be stable between 360 and 420 px.
- Main controls stay visible without scrolling.
- If content overflows, settings/debug can scroll below the fold.
- No nested cards.
- Use dark surfaces, thin separators, and a bottom command rail instead of floating cards.
- The visual reference is the Onkyo Hi-res mobile app screenshots, adapted to desktop popover ergonomics.

## 2. Status Header

Content:

- Home/back icon area
- Centered app/receiver identity
- Current input/source label
- Power button on the right
- Connection state in compact form, not a large pill in the normal state

States:

| State | Display |
| --- | --- |
| Service loading | `Connecting...` |
| Service unreachable | `Service Offline` |
| Receiver disconnected | `Receiver Offline` |
| Reconnecting | `Reconnecting...` |
| Connected | `Connected` |
| Command pending | Keep connected state and show pending on specific control |

Behavior:

- Status should be readable at a glance.
- Clicking status can open diagnostics/settings later.
- Do not use long explanatory copy in normal state.
- Prefer centered, airy typography similar to the reference screenshots, but keep desktop text sizes compact enough for a popover.

## 3. Volume Control

Elements:

- Current volume number.
- Slider.
- Step down button.
- Step up button.

Rules:

- Step buttons send one command per click.
- Slider drag updates local thumb immediately.
- Service command should be sent on drag end, or throttled to no more than one command every 150 ms.
- If service reports a different final volume, snap to reported state.
- Disable controls when receiver is disconnected.

Errors:

- If set volume fails, restore last known service state and show one-line error.

## 4. Power And Mute

Power:

- Use icon button with tooltip `Power`.
- Connected power-off state should still allow `Power On`.
- Pending state should show progress on the button, not block the entire popover.

Mute:

- Toggle button.
- Muted state must be visually distinct.
- Mute should not change volume slider position.

## 5. Playback Controls

Controls:

- Previous
- Play/Pause
- Next

Rules:

- If playback status is unknown, show Play/Pause as enabled only when service says playback command is supported for current input.
- If support is unknown, keep button enabled but handle service errors gracefully.
- Do not hide playback controls just because metadata is missing.

## 6. Input Selector

Default inputs:

- CD
- NET
- USB
- Bluetooth
- Line
- Tuner

Rules:

- Use a modal/sheet-style input picker inspired by the reference input overlay when opened from the bottom rail.
- Show inputs as a two-column icon grid with thin outline icons.
- Highlight selected input with a blue outline/fill treatment.
- Use segmented control only as a fallback for very small preview/test layouts.
- Show pending state on selected target while switching.
- Input labels are human-readable.
- eISCP codes live in shared/service layer, not UI.

## 7. Presets

Default presets:

| Preset | Behavior |
| --- | --- |
| Work Jazz | Power on, switch source, set normal work volume |
| Focus Quiet | Set lower volume, unmute |
| Stop | Pause or standby depending on config |

Rules:

- Preset buttons show pending while running.
- `Stop` must be labeled `Stop` only if it does not power off. If it sends standby, label should be `Standby`.
- Presets should show concise failure message if any command fails.
- A preset should not permanently block manual controls while it runs unless the service requires it.

## 8. Now Playing

Fields:

- Title
- Artist
- Album
- Playback status
- Time, optional
- Artwork, optional

Fallbacks:

| Missing Data | UI |
| --- | --- |
| No title | `No track info` |
| Artist missing | Hide artist line or show album only |
| Album missing | Hide album |
| Metadata unsupported | Keep section small and muted |
| Artwork missing | Use a restrained placeholder, not a blank square |

Rules:

- Now Playing becomes the primary center of the popover when metadata is present.
- Use an artwork-led layout inspired by the reference player screen, but cap artwork so volume/playback remain visible.
- Album art fetching via `NJA` remains a separate protocol task. The UI pass can prepare the layout and use a placeholder until real artwork exists.
- Long title/artist text must truncate or wrap cleanly without pushing controls off-screen.

## 8.1 Network And Music Server Views

The reference screenshots include a Network source grid and Music Server folder list.

Current product decision:

- Network input/source switching is in scope.
- Full Music Server/NAS browsing remains out of scope until `NLS`/`NLA` behavior is captured from the real CR-N775.
- The desktop UI may include a placeholder browser route only if it is clearly disabled or marked unavailable by state, not as a fake working browser.

## 9. Settings

Initial settings:

- Service URL
- Connection test action
- Shortcut list, read-only at first
- Preset note/config link if presets are file-based

Rules:

- Settings can be a secondary view inside the popover.
- Provide Back button/icon.
- Avoid a separate large preferences window unless needed later.

## 10. Keyboard Shortcuts

Suggested defaults:

| Shortcut | Action |
| --- | --- |
| `Cmd+Shift+Up` | Volume up |
| `Cmd+Shift+Down` | Volume down |
| `Cmd+Shift+Space` | Play/pause |
| `Cmd+Shift+M` | Mute |
| `Cmd+Shift+O` | Open/close popover |

Rules:

- If shortcut registration fails, show it in settings.
- Shortcuts should be configurable later.
- Do not fail app startup because a shortcut is unavailable.
- In browser preview, mark shortcuts as unavailable and keep all controls accessible on screen.
- In the Tauri shell, record each shortcut as active or unavailable. External macOS shortcut conflicts are non-fatal and should not disable the matching on-screen control.

## 11. API Assumptions

Expected state shape:

```ts
type OControlState = {
  service: {
    connected: boolean;
    error?: string;
  };
  receiver: {
    connected: boolean;
    model?: string;
    power: "on" | "standby" | "unknown";
    input?: "cd" | "net" | "usb" | "bluetooth" | "line" | string;
    volume?: number;
    muted?: boolean;
    playback?: "playing" | "paused" | "stopped" | "unknown";
  };
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    time?: string;
    track?: string;
  };
  pending?: {
    command?: string;
    preset?: string;
  };
};
```

Expected event shape:

```ts
type OControlEvent =
  | { type: "state.changed"; state: OControlState }
  | { type: "command.failed"; command: string; message: string }
  | { type: "connection.changed"; state: OControlState };
```

The exact shared types may differ, but UI should receive equivalent normalized state without raw eISCP parsing.

## 12. Visual QA Checklist

- [ ] Normal connected state.
- [ ] Service unreachable.
- [ ] Receiver disconnected.
- [ ] Command pending.
- [ ] Command failure.
- [ ] Power off but service reachable.
- [ ] Volume updates from WebSocket.
- [ ] Metadata empty.
- [ ] Long title/artist strings.
- [ ] Narrow popover width.
- [ ] Dark mode.
- [ ] Light mode.
