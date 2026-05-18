# Task: Package O-Control as a Native macOS App

## Goal

Turn the existing Tauri desktop companion into a practical macOS app that can be opened from Finder and used without manually starting the Node service in a separate terminal.

The app should keep the current architecture:

```text
Tauri macOS app
  -> React control UI
  -> local or external O-Control service
  -> Onkyo CR-N775 over eISCP
```

Do not pursue macOS Control Center / WidgetKit controls for this task. The native app route has better value because the current Tauri UI and service are already implemented.

## Current State

Already present:

- `apps/desktop`: React/Vite UI for the compact controller.
- `apps/desktop/src-tauri`: Tauri 2 shell with tray/menu wiring and close-to-tray behavior.
- `packages/service`: Fastify HTTP/WebSocket service that controls the receiver.
- `apps/raycast`: optional Raycast commands that call the same service API.
- `npm run tauri:build -w @o-control/desktop`: configured to build `.app` and `.dmg`.

Main gap:

- The packaged Tauri app currently expects an O-Control service to already be running at `http://127.0.0.1:8787`.

## Desired Behavior

Default local mode:

- Opening `O-Control.app` starts the bundled/local service automatically.
- The desktop UI connects to the local service.
- Quitting the app stops the child service process started by the app.
- If port `8787` is already occupied, the app either reuses a healthy O-Control service or starts on a fallback port and passes that URL to the UI.
- Service startup failures are visible in the UI with a clear error state.

External service mode:

- The app still supports using a remote service URL, for example a service running on an N100 or another LAN host.
- If the user sets a custom service URL, the Tauri shell should not force-start a local service unless explicitly configured to do so.

## Implementation Plan

1. Audit build/runtime constraints
   - Verify Tauri 2 APIs available for sidecars or managed child processes.
   - Decide whether to package the service as a Node-based sidecar, a bundled executable, or a small native/Rust service bridge.
   - Prefer the smallest change that can ship reliably on the developer's Mac first.

2. Add service lifecycle support in Tauri
   - Add Rust-side startup logic in `apps/desktop/src-tauri/src/lib.rs` or a small module under `apps/desktop/src-tauri/src/`.
   - Health-check `GET /health` before starting a child process.
   - Start the service if local mode is enabled and no healthy service is already running.
   - Stop only the child process owned by the app on quit.
   - Avoid killing unrelated user processes on the same port.

3. Make UI aware of managed service state
   - Expose a Tauri command that returns service mode, service URL, health status, and startup errors.
   - Keep the existing HTTP/WebSocket client path for browser preview.
   - In the Tauri shell, prefer the managed service URL unless the user configured an external URL.

4. Package the service for production
   - Add a repeatable build step for the service artifact.
   - Ensure the Tauri bundle includes that artifact.
   - Ensure `.env` handling is appropriate for a packaged app.
   - The receiver host should remain user-configurable; do not hard-code the verified local IP as production config.

5. Improve first-run/settings flow
   - Settings should make it clear whether the app is using local managed service or external service URL.
   - Provide fields for receiver host/port if local mode owns the service config.
   - Keep failures actionable: service unreachable, receiver unreachable, invalid config, port conflict.

6. Verification
   - `npm test`
   - `npm run build --workspaces --if-present`
   - `npm run tauri:build -w @o-control/desktop`
   - Manual smoke with `MOCK_MODE=true` or a bundled mock config.
   - Manual smoke against the real CR-N775 if available.

7. Documentation
   - Update `README.md` with the packaged macOS app workflow.
   - Add troubleshooting for service startup, port conflict, and receiver connectivity.
   - Mention that Control Center integration is intentionally out of scope.

## Acceptance Criteria

- A fresh build produces a usable macOS `.app` and `.dmg`.
- Launching the app in local mode does not require a manually started terminal service.
- The app can show receiver state and run at least power, volume, mute, input, playback, and preset commands through the managed service.
- External service URL mode still works.
- Closing the window hides to tray/menu bar; quitting exits the app and cleans up its owned child service.
- Build and test commands above are documented with pass/fail notes.
- No GPL code is copied from reference projects.

## Key Files

- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src/ui/useOControlApi.ts`
- `apps/desktop/src/components/ServiceSettings.tsx`
- `packages/service/src/server.ts`
- `packages/service/src/config.ts`
- `README.md`
- `docs/feature-scope.md`

## Decisions Made During Implementation

- **Sidecar Packaging Strategy**: The Node/Fastify service is bundled into a single CommonJS file using `esbuild` and packaged into a standalone macOS executable using `@yao-pkg/pkg`. Node.js SEA (Single Executable Application) was attempted but failed due to Homebrew's Node.js 26 missing the required `NODE_SEA_FUSE` sentinel. `pkg` was chosen as a reliable alternative.
- **Service Configuration**: Configuration is managed by the Tauri frontend and saved persistently via `tauri-plugin-store` in `settings.json`. The frontend communicates with the Rust backend via a new `useServiceManager` hook to dynamically pass `ONKYO_HOST`, `MOCK_MODE`, and other configurations when spawning the sidecar.
- **Port Strategy**: The sidecar uses port `8787` by default. Dynamic fallback was omitted for simplicity in the MVP, but the Rust backend health-checks the port before spawning to avoid conflicts. If an external service is already running on `8787`, the local manager will detect it as healthy and skip spawning.
- **Pino Logger Modification**: Pino's asynchronous file transport (which uses `worker_threads`) caused issues with the bundled `pkg` executable (`MODULE_NOT_FOUND` for `worker.js`). The logging was simplified to standard synchronous stdout, which works perfectly within the Tauri sidecar log capture.
