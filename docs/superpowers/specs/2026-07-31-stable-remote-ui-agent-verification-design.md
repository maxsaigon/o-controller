# Stable Remote UI and Agent Verification Design

**Date:** 2026-07-31
**Status:** Approved
**Product:** O-Control macOS menu-bar controller for Onkyo CR-N775

## 1. Objective

Refocus O-Control on its primary job: a fast, reliable menu-bar remote for one
Onkyo CR-N775. Refresh the desktop UI without rewriting its state-management
architecture, and add a deterministic verification gate that an agent can run
from build through runtime smoke testing without a physical receiver or user
intervention.

The result must:

- keep the core remote available even when Library/UPnP functionality fails;
- use a stable Native macOS-inspired layout;
- prioritize large artwork and playback information;
- move Volume, Input, Library, and Settings into secondary panels;
- test user-visible behavior rather than implementation details;
- build, start, test, and stop cleanly using a single bounded command.

## 2. Current-State Findings

The repository already has useful coverage for eISCP parsing, service routes,
state reduction, UPnP parsing, and mock-receiver integration. It does not have
desktop React component tests or a single end-to-end verification command.

The baseline audit on 2026-07-31 found:

- `npm test` executes the service assertions but does not exit cleanly because a
  service-side handle remains open;
- Desktop type-check fails because `StatusHeader` references an undefined
  `statusClass`;
- Service type-check fails because several DLNA error returns omit the required
  `success` property;
- UI behavior is coupled to live HTTP/WebSocket state and has no component-level
  regression coverage;
- root scripts separate unit, integration, build, and runtime checks, so an
  agent cannot rely on one deterministic pass/fail gate;
- active uncommitted work adds UPnP/NAS browsing and must be preserved rather
  than overwritten.

These failures are implementation targets, not reasons to broaden the product.

## 3. Product Scope

### 3.1 Primary experience

The default popover is a remote/player. The user can see receiver state, artwork,
track metadata, progress, playback controls, and power without navigating.

### 3.2 Secondary experience

Volume, Input, Library, and Settings open as secondary panels inside the same
popover. Each panel has a clear way back to the player.

Library and UPnP remain supported as secondary work. Their errors and loading
states are isolated from the core remote.

### 3.3 Out of scope

- a state-management rewrite;
- a new design-system abstraction;
- a full browser-driven E2E suite;
- physical-receiver tests as a required gate;
- extending the unfinished UPnP/NAS feature beyond safe UI integration;
- multi-zone control, UDP discovery, or additional receiver models.

## 4. Implementation Approach

Use the existing `DesktopShell`, `useOControlApi`, and component boundaries.
Make surgical changes to markup, CSS, lifecycle cleanup, testability, and root
scripts.

The refreshed UI uses a light Native macOS visual language:

- fixed 390 px popover width;
- 728 px main-player height;
- light neutral surfaces, thin separators, restrained blue accents;
- no layout shift between missing and present metadata;
- icon controls with accessible names and tooltips;
- focused pending and error states rather than global blocking overlays.

No global state library or state machine will be introduced.

## 5. Main Player Layout

The approved layout is v4 from the visual brainstorming session.

### 5.1 Header

The header contains:

- a single connection-status dot on the left;
- centered receiver name `CR-N775`;
- Power on the right.

Connection behavior:

- green dot only when the local service is reachable and the receiver is
  connected;
- red dot for every other connection state;
- no visible `Connected`, `Not connected`, or source text;
- the dot retains an accessible label and tooltip for screen-reader and pointer
  users.

### 5.2 Artwork and metadata

- Artwork is 340 x 340 px inside a 390 px popover.
- Horizontal content padding is 24 px.
- Space below artwork is 18 px.
- Artwork corners use an 18 px radius.
- A fixed-size music placeholder is shown when artwork is missing or fails.
- Long title and artist/album strings use ellipsis and do not resize the player.
- Format information remains a quiet tertiary line.

### 5.3 Playback

- Timeline and elapsed/total time sit below metadata.
- Previous, Play/Pause, and Next remain one-step actions on the main player.
- Pending state disables only the action currently being sent.
- Missing metadata does not hide playback controls.

### 5.4 Bottom rail

The rail contains:

- Remote;
- compact current volume, for example `Vol 22`;
- Library;
- Settings.

Remote is selected on the default screen. Volume opens the full Volume panel.
Library and Settings open their own secondary views. Input selection is kept in
a secondary panel and does not appear on the main player.

## 6. Secondary Panels

### 6.1 Volume

The Volume panel contains the slider, decrement, increment, and Mute controls.
It opens from the compact volume rail item and closes back to the player.

The slider may update its thumb optimistically during drag, but it commits at
drag end. On command failure, it returns to the last service-confirmed value.

### 6.2 Input

Input selection is available from a secondary control surface rather than the
player. The panel retains the existing supported inputs and highlights the
current value. Closing it returns to the player without resetting state.

### 6.3 Library

Library contains the existing NET/USB and UPnP/NAS work. Loading and failure
messages stay inside this panel. A Library failure does not:

- replace the player;
- alter the receiver connection dot;
- disable Power or playback controls;
- clear the last known player metadata.

### 6.4 Settings

Settings remains available while the service or receiver is offline. It contains
service management, connection diagnostics, shortcuts, and access to the
secondary Input picker.

## 7. Data Flow and Error Handling

`useOControlApi` remains the single owner of HTTP requests, WebSocket state,
pending-command state, and command errors.

Rules:

- retain the last confirmed receiver state during a temporary service outage;
- disable receiver commands while the local service is unreachable;
- keep Settings usable while offline;
- do not display optimistic command success as confirmed receiver state;
- show command failures as a concise inline error with controls immediately
  available for retry;
- scope pending state to the relevant control;
- reconnect WebSocket after an unexpected close;
- close sockets and clear all retry/refresh timers on unmount;
- fall back to the fixed artwork placeholder on image load failure;
- keep Library/UPnP errors local to Library.

## 8. Verification Architecture

### 8.1 Required environment

The required gate uses:

- Node.js dependencies already installed for the repository plus Vitest,
  jsdom, and React Testing Library for desktop UI tests;
- the existing mock receiver and service mock mode;
- loopback networking only;
- dynamic ports to avoid collisions;
- bounded startup and test timeouts;
- no physical receiver and no external network.

### 8.2 Test layers

#### Desktop component tests

Tests render real React components with deterministic props or mocked transport
boundaries. They cover:

- green connection dot when service and receiver are connected;
- red dot for service-offline and receiver-offline states;
- absence of visible connection and source text on the player;
- fixed artwork region and placeholder fallback after image error;
- long metadata constrained without changing the component structure;
- Volume and Input panels hidden by default;
- opening and closing the Volume panel;
- opening and closing the secondary Input panel;
- receiver controls disabled while offline and Settings still usable;
- pending state disabling only the relevant action;
- command error display and subsequent retry;
- Library error isolation.

#### API hook tests

Tests cover:

- initial state/preset refresh success;
- refresh failure preserving last confirmed state;
- WebSocket state updates;
- malformed WebSocket event handling;
- reconnect scheduling after close;
- socket and timer cleanup on unmount;
- command submission, pending state, refresh, and error paths.

#### Service lifecycle and contract tests

Tests cover:

- all DLNA play responses include `success`;
- application shutdown stops UPnP discovery and clears service timers;
- the service test process exits without open handles;
- mock mode requires no physical device;
- integration tests allocate and release their ports.

#### Built-artifact smoke test

The smoke test:

1. starts the built service in mock mode on a dynamic loopback port;
2. polls `/health` until success or a short explicit timeout;
3. verifies `/state`;
4. sends at least one receiver command;
5. terminates the child process;
6. fails if startup, health, command handling, or shutdown exceeds its timeout.

### 8.3 Single agent gate

Add a root command:

```bash
npm run verify:agent
```

It runs, in fail-fast order:

1. TypeScript type-check for every workspace;
2. unit and desktop component tests;
3. mock integration tests;
4. desktop production bundle build;
5. Tauri Rust compile check;
6. built-service runtime smoke test;
7. clean process shutdown.

Each stage emits a clear label and non-zero exit code on failure. Every child
process has a timeout and cleanup handler. A successful run exits with code zero
and leaves no receiver, service, browser, or test process running.

CI runs this same command so local agent behavior and continuous verification
cannot drift.

## 9. Agent Repair Loop

The expected autonomous loop is:

1. run `npm run verify:agent`;
2. identify the first failing bounded stage;
3. write or adjust a regression test that reproduces the behavior;
4. make the minimum implementation change;
5. rerun the focused test;
6. rerun `npm run verify:agent`;
7. stop only when the command exits zero.

Failures must be actionable from command output. The gate must never wait for
manual receiver interaction, a browser click, confirmation input, or an
unbounded network operation.

## 10. Acceptance Criteria

The work is complete when:

- the player matches the approved v4 hierarchy and measurements;
- only the colored dot represents connection status in the visible header;
- artwork remains visually stable at 340 x 340 px;
- Volume and Input are absent from the default content area and remain
  accessible through secondary panels;
- Library failures cannot disable or replace the core remote;
- new desktop and lifecycle regressions are covered by automated tests;
- existing unit and integration coverage remains green;
- `npm run verify:agent` builds, starts, tests, and stops without user input;
- the command exits zero twice consecutively with no lingering processes;
- physical-receiver verification remains an optional documented follow-up.
