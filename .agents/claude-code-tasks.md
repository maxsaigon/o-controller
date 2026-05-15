# Claude Code Tasks

Use this file for Claude Code agents that implement non-UI or integration-heavy parts of O-Control.

Do not edit files owned by the UI/UX track unless explicitly coordinated. In particular, avoid changing:

- `apps/desktop/src/ui/**`
- `apps/desktop/src/components/**`
- `apps/desktop/src/styles/**`
- `apps/web/src/ui/**`
- `docs/uiux-plan.md`
- `docs/uiux-spec.md`

If a code task needs a UI change, expose a typed API/hook/contract and report the needed UI work instead of editing UI files.

## Repository

```text
https://github.com/maxsaigon/o-controller.git
```

## Branch Naming

Use one branch per implementation slice:

```text
agent/code-01-reference-audit
agent/code-02-eiscp-protocol
agent/code-03-service-api
agent/code-04-test-harness
agent/code-05-presets
agent/code-06-docker
agent/code-07-raycast
agent/code-08-now-playing
agent/code-09-nas-usb-spike
```

## Shared Rules

- You are not alone in the codebase.
- Do not revert edits made by others.
- Edit only files listed in the ownership section of your task.
- Keep public contracts in `packages/shared`.
- Return changed files, commands run, tests run, and unresolved risks.
- Prefer tests around protocol, service state, and integration behavior.

---

## Code Task 01: Reference Audit

Ownership:

- `docs/reference-audit.md`
- `docs/protocol-notes.md`
- `docs/feature-scope.md`

Work:

- [ ] Review `mkulesh/onpc`, `miracle2k/onkyo-eiscp`, `jhesch/integra`, `tillbaks/node-eiscp`, `ava-brn/lib-eiscp`, and `estbeetoo/node-red-contrib-eiscp`.
- [ ] Document behavior O-Control should learn from, without copying GPL code.
- [ ] Document eISCP packet format and MVP command groups.
- [ ] Create a build/buy decision matrix.
- [ ] Mark all unknowns that require real CR-N775 verification.

Acceptance:

- Docs are specific enough for protocol/service agents.
- License concerns are explicit.
- Unknown hardware behavior is clearly labeled.

---

## Code Task 02: eISCP Protocol Package

Ownership:

- `packages/eiscp/**`
- `packages/eiscp/test-fixtures/**`
- eISCP protocol exports in `packages/shared/**`

Do not edit:

- `packages/service/**`
- UI app files

Work:

- [ ] Implement eISCP packet builder.
- [ ] Implement parser for complete, multiple, and partial packets.
- [ ] Add command constants for power, volume, mute, input, playback, metadata basics.
- [ ] Add volume hex conversion helpers.
- [ ] Add unit tests and packet fixtures.

Expected API:

```ts
export function buildPacket(command: string): Buffer;
export function parsePackets(buffer: Buffer): {
  packets: Array<{ command: string; rawPayload: string }>;
  remaining: Buffer;
};
```

Acceptance:

- Package has no network side effects.
- Parser handles malformed input safely.
- Tests cover builder/parser edge cases.

---

## Code Task 03: Core Service API

Ownership:

- `packages/service/**`
- service-related types in `packages/shared/**`

Do not edit:

- `packages/eiscp/**`, except through public API usage
- UI app files

Work:

- [ ] Create Fastify service package.
- [ ] Add config validation for `ONKYO_HOST`, `ONKYO_PORT`, `O_CONTROL_PORT`, `LOG_LEVEL`.
- [ ] Define normalized state model in shared types.
- [ ] Implement state store and reducer.
- [ ] Implement receiver client wrapper with reconnect behavior.
- [ ] Implement REST endpoints:
  - `GET /health`
  - `GET /state`
  - `POST /commands/power`
  - `POST /commands/volume`
  - `POST /commands/mute`
  - `POST /commands/input`
  - `POST /commands/playback`
  - `POST /presets/:id/run`
- [ ] Implement WebSocket `/events`.
- [ ] Add mock/offline mode.
- [ ] Add tests for routes and reducer.

Acceptance:

- Service runs without real receiver in mock mode.
- WebSocket emits normalized state changes.
- No receiver IP is hard-coded.

---

## Code Task 04: Mock Receiver And Integration Tests

Ownership:

- `tools/mock-receiver/**`
- `tests/integration/**`
- integration fixtures not owned by `packages/eiscp`

Work:

- [ ] Build TCP mock receiver on configurable port.
- [ ] Respond to power, volume, mute, input query commands.
- [ ] Simulate status events.
- [ ] Simulate socket disconnect/reconnect.
- [ ] Add integration test script for service against mock receiver.
- [ ] Document how to run mock receiver.

Acceptance:

- Tests do not require physical CR-N775.
- Service can be tested end-to-end against mock receiver.

---

## Code Task 05: Presets Logic

Ownership:

- `packages/shared/**` preset types
- `packages/service/**` preset execution
- `docs/presets.md`

Do not edit desktop UI files. UI/UX track will render preset controls.

Work:

- [ ] Define `PresetDefinition`.
- [ ] Add default presets: `Work Jazz`, `Focus Quiet`, `Stop`.
- [ ] Implement preset execution in service.
- [ ] Add `POST /presets/:id/run`.
- [ ] Add tests for command order and error handling.

Acceptance:

- Presets are exposed via API and shared types.
- Standby/power-off style actions are explicit in preset definition.

---

## Code Task 06: Docker And Homelab

Ownership:

- `infra/docker/**`
- `.env.example`
- deployment docs
- minimal service healthcheck wiring if required

Work:

- [ ] Add Dockerfile for service.
- [ ] Add Docker Compose.
- [ ] Add healthcheck.
- [ ] Add restart policy.
- [ ] Document Ubuntu 24.04/N100 deployment.
- [ ] Document LAN/Tailscale usage and static IP requirement.

Acceptance:

- Service can be built and run with Docker Compose.
- Receiver host/port are env-driven.
- No secrets are committed.

---

## Code Task 07: Raycast Extension

Ownership:

- `apps/raycast/**`
- `docs/raycast.md`

Do not edit service internals.

Work:

- [ ] Create Raycast extension skeleton.
- [ ] Add service URL preference.
- [ ] Implement power toggle, volume up/down/set, input switch, run preset.
- [ ] Add readable errors when service is unreachable.

Acceptance:

- Extension talks only to service API.
- No eISCP protocol logic is duplicated.

---

## Code Task 08: Now Playing Backend

Ownership:

- metadata state/types in `packages/shared/**`
- metadata handling in `packages/service/**`
- metadata fixtures/tests

Do not edit desktop UI files. UI/UX track owns display.

Work:

- [ ] Add metadata state fields: title, artist, album, playback, time, track.
- [ ] Parse `NTI`, `NAT`, `NAL`, `NST`, `NTM`, `NTR`.
- [ ] Add metadata query/update handling.
- [ ] Add reducer tests.
- [ ] Log unknown metadata events for real-device verification.

Acceptance:

- Empty metadata is valid state.
- Metadata does not break core controls.
- Album art is excluded unless separately approved.

---

## Code Task 09: NAS/USB Browser Spike

Ownership:

- `docs/nas-usb-browser-spike.md`
- optional isolated spike under `spikes/nas-usb-browser/**`

Do not edit production service/UI.

Work:

- [ ] Review reference behavior around `NLS`, `NLA`, navigation, and selection.
- [ ] Identify required real CR-N775 logs.
- [ ] Evaluate UX cost versus benefit.
- [ ] Recommend build, postpone, or skip.

Acceptance:

- Clear recommendation.
- No production code changed.

