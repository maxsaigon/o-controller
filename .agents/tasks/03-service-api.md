# Task 03: Core Service API

Status: Completed for MVP.

Implemented:

- Fastify HTTP service in `packages/service`.
- TCP receiver client with command queue and reconnect scheduling.
- Mock mode.
- CORS support for the desktop browser UI.
- Normalized state store and WebSocket state stream.

Verified by:

- `npm run test:all`
- Live service against CR-N775 at `192.168.1.104`
- API command loop: volume set/restore and mute on/off.
- Dedicated Fastify route tests in `packages/service/src/server.test.ts`.

## Goal

Build the Fastify service that exposes HTTP/WebSocket control APIs and talks to the eISCP client boundary.

## Ownership

You own:

- `packages/service/**`
- Service-specific shared types in `packages/shared/**`

Do not edit `packages/eiscp` except through documented public API assumptions. If the eISCP API is missing something, report it.

## Expected Endpoints

```text
GET  /health
GET  /state
POST /commands/power
POST /commands/volume
POST /commands/mute
POST /commands/input
POST /commands/playback
POST /presets/:id/run
GET  /events
```

## Work Items

- [x] Create Fastify service package.
- [x] Add env config with validation.
- [x] Define normalized state model.
- [x] Implement in-memory state store.
- [x] Implement command controller interface.
- [x] Add service route handlers.
- [x] Add WebSocket event broadcasting.
- [x] Add reconnect-aware receiver client wrapper.
- [x] Add mock/offline mode for development.
- [x] Add unit tests for state reducer.
- [x] Add dedicated Fastify route tests.

## Follow-Up Work

- Consider lowering unknown `NLS`/`NJA` logging level if NET list events are noisy in normal use.

## Acceptance Criteria

- Service can run in mock mode without a real receiver.
- HTTP endpoints return typed responses.
- WebSocket clients receive state changes.
- Reconnect strategy is implemented or stubbed with clear TODO and tests.
- Service does not hard-code receiver IP.

## Return Format

Return:

- Files changed
- API contract summary
- How to run service in mock mode
- Tests run
- Integration points needed from protocol package
