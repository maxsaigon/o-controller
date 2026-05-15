# Task 03: Core Service API

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

- [ ] Create Fastify service package.
- [ ] Add env config with validation.
- [ ] Define normalized state model.
- [ ] Implement in-memory state store.
- [ ] Implement command controller interface.
- [ ] Add service route handlers.
- [ ] Add WebSocket event broadcasting.
- [ ] Add reconnect-aware receiver client wrapper.
- [ ] Add mock/offline mode for development.
- [ ] Add unit tests for state reducer and routes.

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

