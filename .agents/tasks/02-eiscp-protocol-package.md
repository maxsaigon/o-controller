# Task 02: eISCP Protocol Package

## Goal

Implement the low-level TypeScript eISCP package used by the service.

## Ownership

You own:

- `packages/eiscp/**`
- Protocol fixtures under `packages/eiscp/test-fixtures/**`
- eISCP-related exports in `packages/shared/**` only if needed

Do not edit `packages/service` or UI apps.

## Required API

Provide an API similar to:

```ts
export type EiscpCommand = string;
export type EiscpPacket = {
  command: string;
  rawPayload: string;
};

export function buildPacket(command: EiscpCommand): Buffer;
export function parsePackets(buffer: Buffer): {
  packets: EiscpPacket[];
  remaining: Buffer;
};
```

You may adjust names if documented, but keep the package small.

## Work Items

- [ ] Create package skeleton.
- [ ] Implement packet builder.
- [ ] Implement parser for complete packets.
- [ ] Handle multiple packets in one TCP chunk.
- [ ] Handle partial packet buffering.
- [ ] Add command constants for MVP commands.
- [ ] Add utilities for hex volume conversion.
- [ ] Add unit tests.
- [ ] Add fixtures based on protocol notes.

## Acceptance Criteria

- Tests pass for builder/parser.
- API is independent from receiver connection management.
- No network calls are made from this package.
- Parser failures are explicit and do not crash callers by default.

## Return Format

Return:

- Files changed
- Public API summary
- Tests run
- Edge cases not covered

