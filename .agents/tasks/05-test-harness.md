# Task 05: Mock Receiver And Test Harness

## Goal

Create a mock eISCP receiver and test harness so service/protocol work can be verified without the physical CR-N775.

## Ownership

You own:

- `tools/mock-receiver/**`
- `tests/integration/**`
- Test fixtures that are not owned by `packages/eiscp`

Do not edit production service/protocol implementation except to add documented test hooks, and only if necessary.

## Work Items

- [ ] Build a small TCP mock receiver that listens on configurable port.
- [ ] Parse incoming eISCP commands using protocol package if available.
- [ ] Respond to query commands: power, volume, mute, input.
- [ ] Emit simulated status events.
- [ ] Support disconnect/reconnect simulation.
- [ ] Add integration test script.
- [ ] Document how to run mock receiver.

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

