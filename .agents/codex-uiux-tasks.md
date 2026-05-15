# Codex UI/UX Tasks

Status updated: 2026-05-15

Current UI status:

- Product UX docs exist in `docs/uiux-plan.md` and `docs/uiux-spec.md`.
- React/Vite desktop companion UI exists in `apps/desktop`.
- UI has been verified against mock service and a real CR-N775 through the service at `192.168.1.104`.
- Visual QA notes and screenshot exist in `docs/uiux-review`.
- Native Tauri menu bar/tray shell is not implemented yet.

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

Status: Completed.

Ownership:

- `docs/uiux-plan.md`
- `docs/uiux-spec.md`

Work:

- [x] Define primary user workflows.
- [x] Define information hierarchy for menu bar popover.
- [x] Define all UI states: connected, disconnected, reconnecting, command pending, error, metadata missing.
- [x] Define keyboard shortcut behavior.
- [x] Define preset interaction behavior.
- [x] Define responsive behavior for optional web UI.
- [x] Define visual style: compact, calm, macOS-friendly, low distraction.

Acceptance:

- Spec is implementation-ready.
- It does not require service internals.
- It clearly identifies API/state assumptions.

---

## UI/UX Task 02: Desktop Menu Bar Shell

Status: Partial. Browser-hosted React UI is complete; native menu bar shell remains.

Ownership:

- `apps/desktop/src/app-shell/**`
- `apps/desktop/src/ui/**`
- `apps/desktop/src/components/**`
- `apps/desktop/src/styles/**`

Work:

- [x] Build compact menu bar popover layout.
- [x] Add connection status area.
- [x] Add power/mute/play-pause icon controls.
- [x] Add volume slider with step buttons.
- [x] Add input selector.
- [x] Add preset row.
- [x] Add now-playing placeholder area.
- [x] Add settings surface for service URL and shortcuts.
- [x] Add disabled/pending/error visual states.

Remaining:

- [ ] Add native Tauri menu bar/tray wrapper.
- [ ] Verify native window sizing and focus behavior.

Acceptance:

- UI works with mock state.
- Text fits within compact popover.
- UI does not assume metadata exists.
- Controls are visually stable and do not resize unexpectedly.

---

## UI/UX Task 03: Interaction Design

Status: Mostly complete for browser UI; native shortcut conflict handling remains.

Ownership:

- `docs/uiux-spec.md`
- desktop interaction components under UI-owned paths

Work:

- [x] Define volume drag behavior to avoid command floods.
- [x] Define command pending feedback.
- [x] Define reconnect/offline behavior.
- [ ] Define shortcut conflict/error behavior.
- [x] Define preset confirmation behavior for standby/power-off actions.
- [x] Define tooltip labels for icon-only buttons.

Acceptance:

- Interactions are keyboard-friendly.
- Offline state remains useful and understandable.
- Dangerous actions are not accidental.

---

## UI/UX Task 04: Visual QA

Status: Partial. Connected state is verified and captured; more state matrix screenshots remain.

Ownership:

- `docs/uiux-review/**`
- UI-owned files needed to fix visual issues

Work:

- [x] Run desktop app against mock service.
- [x] Run desktop app against real CR-N775 service.
- [x] Capture screenshot for normal connected state.
- [ ] Capture screenshots for offline, pending, error, and long metadata states.
- [x] Verify compact popover at expected sizes.
- [x] Verify text does not overlap in connected/settings states.
- [x] Verify icon buttons and sliders are usable.
- [x] Record issues and fixes in `docs/uiux-review/`.

Acceptance:

- Visual QA notes exist.
- UI has been checked against multiple states.
- Remaining visual risks are explicit.

---

## UI/UX Task 05: Optional Web Debug UI

Status: Not started. Lower priority because the desktop UI already runs in browser preview.

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
