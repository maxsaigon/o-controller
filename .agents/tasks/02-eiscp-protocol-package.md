# Task 02: eISCP Protocol Package

Status: Completed.

Implemented:

- `packages/eiscp/src/index.ts`
- `packages/eiscp/src/index.test.ts`
- `packages/eiscp/src/test-fixtures.ts`

Verified by:

- Unit tests for packet build/parse, partial packets, multiple packets, garbage recovery, EOF terminators, volume helpers, and command constants.
- Real CR-N775 query responses parsed successfully from `192.168.1.104:60128`.

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

- [x] Create package skeleton.
- [x] Implement packet builder.
- [x] Implement parser for complete packets.
- [x] Handle multiple packets in one TCP chunk.
- [x] Handle partial packet buffering.
- [x] Add command constants for MVP commands.
- [x] Add utilities for hex volume conversion.
- [x] Add unit tests.
- [x] Add fixtures based on protocol notes.

## Follow-Up Work

- Add new fixtures if real hardware shows additional packet terminators or metadata payload variants.
- Keep network connection management out of this package.

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
