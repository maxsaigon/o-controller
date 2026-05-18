# O-Control UI/UX Plan

## 1. Product Positioning

O-Control is a compact macOS companion for controlling an Onkyo CR-N775 while working. It should feel like a quiet system utility, not a full music-center application.

Primary job:

- Control receiver state without touching a phone.
- Keep the interaction fast enough to use during work.
- Show only the information needed to make the next action.

Non-goals for the first UI pass:

- No full music library browser.
- No marketing screen.
- No large dashboard-first experience.
- No decorative visual system.
- No dependency on metadata being available.

## 2. Primary Workflows

### Workflow A: Start Music

User intent: begin a normal work listening session.

Expected path:

1. Open menu bar popover.
2. Click `Work Jazz` preset.
3. Receiver powers on if needed.
4. Input switches to configured source.
5. Volume is set to configured level.
6. Popover shows final state.

Success criteria:

- One click from popover.
- No modal unless the preset includes a destructive/off action.
- Pending state is visible while commands run.

### Workflow B: Adjust Volume

User intent: make a quick volume adjustment without context switching.

Expected path:

1. Use global shortcut, step buttons, or slider.
2. UI updates optimistically only if command is accepted by service.
3. Physical receiver volume changes update UI via WebSocket.

Success criteria:

- Step buttons are easier to hit than the slider for small changes.
- Slider drag is debounced/throttled to avoid command floods.
- Current volume remains legible at all times.

### Workflow C: Pause Or Stop

User intent: pause audio or stop the session.

Expected path:

1. Click play/pause or `Stop`.
2. If `Stop` means standby, label must make that clear.
3. UI shows pending and then final state.

Success criteria:

- No accidental standby from a tiny ambiguous button.
- The play/pause control remains available even if metadata is missing.

### Workflow D: Switch Source

User intent: change receiver input.

Expected path:

1. Open input menu.
2. Choose CD, NET, USB, Bluetooth, or Line.
3. UI shows selected/pending state.

Success criteria:

- Inputs use human labels, not eISCP codes.
- Unsupported inputs can be hidden by config later.

### Workflow E: Diagnose Connection

User intent: understand why controls are not working.

Expected path:

1. Status indicator shows Offline/Reconnecting/Error.
2. Popover gives short reason if available.
3. Settings exposes service URL.

Success criteria:

- Offline UI is still useful.
- User can tell whether the app cannot reach service or service cannot reach receiver.

## 3. Information Hierarchy

Menu bar popover order:

1. Connection and receiver summary.
2. Primary controls: power, volume, mute.
3. Playback controls.
4. Input selector.
5. Presets.
6. Now Playing.
7. Settings/debug access.

Rationale:

- Connection and receiver summary answer "can I control it now?"
- Power/volume/mute are most frequent during work.
- Now Playing is useful but not essential, so it should not dominate the compact UI.

## 4. Visual Direction

Tone:

- Compact
- Calm
- Hi-fi remote inspired
- macOS-friendly
- Low distraction

Reference direction:

- Use the attached Onkyo Hi-res mobile screenshots as the primary mood reference.
- Borrow the quiet dark surface, warm lower gradient, thin outline icons, centered receiver/source hierarchy, and bottom command rail.
- Adapt the pattern to a macOS menu bar popover instead of cloning the mobile layout.
- The desktop app should feel like a small premium audio remote, not a generic settings utility.

Avoid:

- Large cards inside cards
- Oversized hero typography
- Decorative gradients/orbs
- One-color theme
- Text-heavy explanatory UI
- iPhone status bar, phone navigation chrome, or full mobile screen proportions

Suggested palette:

- Background: charcoal/near-black primary surface with a subtle warm brown lower band.
- Primary text: soft off-white, not pure white.
- Secondary text: muted gray.
- Accent: Onkyo-like blue for active power/input/selected states.
- Warning/error: system amber/red only when needed.

Suggested dimensions:

- Popover width: 340-380 px.
- Minimum content height: 420 px.
- Icon button size: 32 px.
- Slider row height: 44 px.
- Border radius: 6-8 px.
- Spacing unit: 8 px.

## 5. Component Set

Required components:

- `StatusHeader`
- `PowerButton`
- `VolumeControl`
- `MuteButton`
- `PlaybackControls`
- `InputSelector`
- `PresetStrip`
- `NowPlaying`
- `ServiceSettings`
- `ConnectionBanner`
- `CommandErrorInline`

Optional later:

- `RawEventPanel` for web/debug UI.
- `DeviceDiagnostics`.
- `ShortcutRecorder`.

## 6. State Coverage

The UI must render all states below:

- Service loading
- Service unreachable
- Service connected, receiver disconnected
- Receiver reconnecting
- Receiver connected and power off
- Receiver connected and power on
- Command pending
- Command failed
- Metadata empty
- Metadata present
- Preset running

## 7. Implementation Boundary

UI consumes:

- `GET /state`
- `GET /events`
- `POST /commands/*`
- `POST /presets/:id/run`
- shared types from `packages/shared`

UI does not:

- Build eISCP packets.
- Open sockets to the receiver.
- Parse raw receiver events.
- Hard-code receiver IP.
