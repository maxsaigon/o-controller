# Task 05: Mock Receiver And Test Harness

Status: Mostly complete.

Implemented:

- TCP mock receiver in `tools/mock-receiver`.
- Integration tests in `tests/integration/service-mock.test.ts`.
- Root scripts: `test:integration` and `test:all`.

Verified by:

- `npm run test:all` passes unit and integration tests.

Not completed:

- Explicit disconnect/reconnect simulation tests.

## Goal

Create a mock eISCP receiver and test harness so service/protocol work can be verified without the physical CR-N775.

## Ownership

You own:

- `tools/mock-receiver/**`
- `tests/integration/**`
- Test fixtures that are not owned by `packages/eiscp`

Do not edit production service/protocol implementation except to add documented test hooks, and only if necessary.

## Work Items

- [x] Build a small TCP mock receiver that listens on configurable port.
- [x] Parse incoming eISCP commands using protocol package if available.
- [x] Respond to query commands: power, volume, mute, input.
- [x] Emit simulated status events for core command responses.
- [ ] Support disconnect/reconnect simulation.
- [x] Add integration test script.
- [x] Document how to run mock receiver.

## Follow-Up Work

- Add tests for service reconnect after socket close/error.
- Add tests for browser/API behavior while the receiver is temporarily disconnected.

## Acceptance Criteria

- Mock receiver can be started locally.
- Service can connect to mock receiver.
- Integration tests can validate command send and event receive.
- Tests are deterministic and do not require real hardware.

## Return Format

Return:

- Files changed
- How to run mock receiver
- Tests run
- Any assumptions about protocol package API
