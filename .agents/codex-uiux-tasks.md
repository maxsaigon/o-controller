# Codex UI/UX Tasks

This file is reserved for Codex-owned UI/UX work. Claude Code agents should not edit this file or the files owned by this track.

The UI/UX track should make O-Control feel like a compact macOS productivity remote, not a full media-center clone.

## Repository

```text
https://github.com/maxsaigon/o-controller.git
```

## Branch Naming

Use:

```text
codex/uiux-desktop-companion
```

Optional later branches:

```text
codex/uiux-web-debug
codex/uiux-now-playing
```

## UI/UX Ownership

Codex owns:

- `docs/uiux-plan.md`
- `docs/uiux-spec.md`
- `apps/desktop/src/ui/**`
- `apps/desktop/src/components/**`
- `apps/desktop/src/styles/**`
- `apps/desktop/src/app-shell/**`
- `apps/web/src/ui/**`, if web UI is implemented
- visual QA notes/screenshots under `docs/uiux-review/**`

Claude Code owns service/protocol/integration work and should expose typed contracts for UI to consume.

## Shared Contract Boundary

UI should consume only:

- `GET /state`
- `GET /events`
- command endpoints under `/commands/*`
- preset endpoint under `/presets/:id/run`
- shared types from `packages/shared`

UI should not:

- Open TCP sockets to CR-N775.
- Build eISCP packets.
- Parse raw eISCP events.
- Hard-code receiver IP.

---

## UI/UX Task 01: Product UX Spec

Ownership:

- `docs/uiux-plan.md`
- `docs/uiux-spec.md`

Work:

- [ ] Define primary user workflows.
- [ ] Define information hierarchy for menu bar popover.
- [ ] Define all UI states: connected, disconnected, reconnecting, command pending, error, metadata missing.
- [ ] Define keyboard shortcut behavior.
- [ ] Define preset interaction behavior.
- [ ] Define responsive behavior for optional web UI.
- [ ] Define visual style: compact, calm, macOS-friendly, low distraction.

Acceptance:

- Spec is implementation-ready.
- It does not require service internals.
- It clearly identifies API/state assumptions.

---

## UI/UX Task 02: Desktop Menu Bar Shell

Ownership:

- `apps/desktop/src/app-shell/**`
- `apps/desktop/src/ui/**`
- `apps/desktop/src/components/**`
- `apps/desktop/src/styles/**`

Work:

- [ ] Build compact menu bar popover layout.
- [ ] Add connection status area.
- [ ] Add power/mute/play-pause icon controls.
- [ ] Add volume slider with step buttons.
- [ ] Add input selector.
- [ ] Add preset row.
- [ ] Add now-playing placeholder area.
- [ ] Add settings surface for service URL and shortcuts.
- [ ] Add disabled/pending/error visual states.

Acceptance:

- UI works with mock state.
- Text fits within compact popover.
- UI does not assume metadata exists.
- Controls are visually stable and do not resize unexpectedly.

---

## UI/UX Task 03: Interaction Design

Ownership:

- `docs/uiux-spec.md`
- desktop interaction components under UI-owned paths

Work:

- [ ] Define volume drag behavior to avoid command floods.
- [ ] Define command pending feedback.
- [ ] Define reconnect/offline behavior.
- [ ] Define shortcut conflict/error behavior.
- [ ] Define preset confirmation behavior for standby/power-off actions.
- [ ] Define tooltip labels for icon-only buttons.

Acceptance:

- Interactions are keyboard-friendly.
- Offline state remains useful and understandable.
- Dangerous actions are not accidental.

---

## UI/UX Task 04: Visual QA

Ownership:

- `docs/uiux-review/**`
- UI-owned files needed to fix visual issues

Work:

- [ ] Run desktop app against mock service.
- [ ] Capture screenshots for normal, offline, pending, and metadata states.
- [ ] Verify compact popover at expected sizes.
- [ ] Verify text does not overlap.
- [ ] Verify icon buttons and sliders are usable.
- [ ] Record issues and fixes in `docs/uiux-review/`.

Acceptance:

- Visual QA notes exist.
- UI has been checked against multiple states.
- Remaining visual risks are explicit.

---

## UI/UX Task 05: Optional Web Debug UI

Ownership:

- `apps/web/src/ui/**`
- `docs/uiux-web-debug.md`

Only start after core desktop UX is stable.

Work:

- [ ] Design debug-oriented web layout.
- [ ] Add state panel.
- [ ] Add core controls.
- [ ] Add bounded raw event panel.
- [ ] Add responsive tablet/desktop behavior.

Acceptance:

- Web UI is clearly secondary.
- It supports debugging without becoming a full media center.

