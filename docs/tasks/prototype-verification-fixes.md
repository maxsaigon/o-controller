# Prototype Verification Fixes

This task closes the remaining verification gaps found after the prototype checklist was marked complete.

Keep the scope narrow. Do not add new product features. The goal is to make the existing README-aligned prototype clean, verifiable, and ready to hand off.

## Context

The prototype core already passes:

- `npm test`
- `npm run test:integration`
- `npm run build:app`
- Sidecar binary smoke test in mock mode

However, verification found five remaining issues that should be fixed before calling the prototype complete.

## Tasks

### 1. Persisted Receiver IP Must Rehydrate Into Settings UI

Problem:

- `ServiceSettings` lets the user enter a receiver host/IP.
- `service_manager.rs` stores `localConfig`.
- `ServiceSettings` only syncs `serviceMode` and `externalUrl` from `serviceManager.status`.
- The saved `localConfig.host` is not exposed back to the React UI, so the Settings form can reopen with an empty receiver host even if the store contains one.

Required outcome:

- The Settings form shows the saved receiver host/IP after app restart or settings refresh.
- Saved `localConfig.port` and `localConfig.mockMode` should also rehydrate if they are stored.
- Keep the UI simple. Do not add discovery or profile management.

Suggested implementation direction:

- Extend the Tauri service manager command/status shape to expose current config, or add a small `get_service_config` command.
- Update `useServiceManager` to retain the current `ServiceConfig`.
- Update `ServiceSettings` to initialize/sync its draft from the stored config.

Acceptance:

- [ ] Save a local receiver host.
- [ ] Reopen Settings.
- [ ] The host field still shows the saved value.
- [ ] Restart the app, open Settings, and confirm the host field still shows the saved value.

### 2. Remove Fake Auto-Discovery Copy

Problem:

- `ServiceSettings` currently uses the placeholder `Auto-discover if empty`.
- The README and prototype plan explicitly use static receiver IP configuration.
- UDP discovery is out of scope.

Required outcome:

- Replace auto-discovery copy with static-IP copy.

Acceptance:

- [ ] Receiver host placeholder is a concrete example such as `192.168.1.104`.
- [ ] No UI text implies auto-discovery exists.

### 3. Fix Whitespace Check Failures

Problem:

- `git diff --check` currently fails on trailing whitespace.

Files observed:

- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src/app-shell/DesktopShell.tsx`
- `apps/desktop/src/components/ServiceSettings.tsx`

Required outcome:

- Remove trailing whitespace from touched files.

Acceptance:

- [ ] `git diff --check` exits successfully.

### 4. Remove Or Formalize Scratch WebSocket Test

Problem:

- `ws-test.js` is an untracked scratch file at the repo root.
- It hardcodes `ws://127.0.0.1:8787/events`.
- It should not be left as an accidental prototype artifact.

Required outcome:

- Prefer deleting `ws-test.js`.
- If keeping it, move it under a proper tool/test location, add a package script, document when to use it, and avoid making it part of the prototype acceptance path.

Acceptance:

- [ ] No untracked root-level `ws-test.js` remains.
- [ ] `git status --short` does not show accidental scratch files.

### 5. Remove Rust Warning

Problem:

- `npm run build:app` reports an unused import warning in `service_manager.rs`.

Observed warning:

```text
unused import: `Manager`
```

Required outcome:

- Remove the unused import or otherwise make the release build warning-free for this issue.

Acceptance:

- [ ] `npm run build:app` no longer reports the `unused import: Manager` warning.

## Required Verification

Run these commands after the fixes:

```bash
git diff --check
npm test
npm run test:integration
npm run build:app
```

Also run a sidecar smoke test in mock mode:

```bash
MOCK_MODE=true O_CONTROL_PORT=18787 LOG_LEVEL=silent apps/desktop/src-tauri/binaries/o-control-service-aarch64-apple-darwin
```

In another terminal:

```bash
curl -sS http://127.0.0.1:18787/health
curl -sS http://127.0.0.1:18787/state
curl -sS -X POST http://127.0.0.1:18787/commands/volume \
  -H 'content-type: application/json' \
  -d '{"value":22}'
```

Stop the sidecar process after the smoke test.

## Out Of Scope

Do not work on:

- NAS/USB browser.
- Album art.
- Raycast features.
- Docker/N100 deployment.
- UDP discovery.
- Multi-zone support.
- Large UI redesign.
- New settings architecture beyond the saved local config rehydration needed above.
