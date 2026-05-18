# Settings Device Management Plan

This task expands the Settings tab from a single receiver host field into a reliable device-management workflow.

The product goal remains:

```text
Install app -> find or add Onkyo device -> test connection -> control N775
```

This task intentionally changes the previous prototype boundary: LAN device discovery is now in scope for Settings. Do not expand into NAS/USB browsing, album art, Raycast, Docker, or multi-zone control.

## Current State

Settings currently supports:

- Local or external service mode.
- One local receiver host field.
- Mock mode toggle.
- Save and restart.
- Test connection button that refreshes the service state.
- Shortcut status list.

Problems visible from the current UI/screenshot:

- Settings is too low-level: it exposes service mode before receiver/device selection.
- There is no device list.
- There is no add/edit/delete workflow.
- There is no real manual connection test per device.
- LAN auto-detect is missing.
- Checkbox/control sizing looks rough.
- The Settings view scrolls awkwardly and can show horizontal overflow.

## Target Settings Workflow

Primary user path:

1. Open Settings.
2. See current active device.
3. Click `Scan LAN`.
4. App finds Onkyo receivers on the local network.
5. User selects a discovered receiver.
6. User clicks `Test`.
7. User clicks `Use Device`.
8. App saves the device, restarts/reconfigures the local service, and returns to connected state.

Manual fallback:

1. Click `Add`.
2. Enter name, host/IP, and port.
3. Click `Test`.
4. Save.
5. Set as active device.

Device maintenance:

- Edit device name, host, port.
- Delete device after confirmation.
- Mark one device as active.
- Keep mock mode available but visually secondary.

## Data Model

Add a persisted device model in Tauri store.

Suggested TypeScript shape:

```ts
export interface ReceiverDevice {
  id: string;
  name: string;
  host: string;
  port: number;
  model?: string;
  macAddress?: string;
  lastSeenAt?: string;
  lastTestAt?: string;
  lastTestStatus?: 'unknown' | 'online' | 'offline';
  source: 'manual' | 'discovered';
}

export interface ServiceConfig {
  serviceMode: 'local' | 'external';
  activeDeviceId?: string;
  devices?: ReceiverDevice[];
  localConfig?: {
    host?: string;
    port?: number;
    mockMode?: boolean;
  };
  externalUrl?: string;
}
```

Rules:

- Keep backward compatibility with existing `localConfig.host`.
- On first launch, if `localConfig.host` exists and no devices exist, migrate it into one manual device.
- `activeDeviceId` determines which device is passed to the sidecar as `ONKYO_HOST` and `ONKYO_PORT`.
- `localConfig.mockMode` remains global for local mode.

## Discovery Design

Use Onkyo eISCP discovery over UDP.

Implementation direction:

- Add a Tauri command such as `discover_onkyo_devices`.
- Send the eISCP discovery query `!xECNQSTN` over UDP broadcast.
- Use port `60128`.
- Listen for responses for a bounded timeout, for example 2-4 seconds.
- Parse response enough to extract host, model/name if available, and MAC if available.
- De-duplicate by MAC address when present, otherwise by `host:port`.
- Return discovered devices to the React UI without automatically saving them.

Notes:

- `docs/reference-audit.md` already mentions UDP discovery on port `60128` with `!xECNQSTN`.
- Verify behavior against the real CR-N775 because discovery response format can vary.
- If UDP broadcast is blocked by macOS/network settings, show a clear empty-state with manual add fallback.

Acceptance:

- [ ] `Scan LAN` starts discovery and shows loading state.
- [ ] Discovery returns zero or more devices without crashing.
- [ ] Discovered devices show host, port, and best available display name.
- [ ] Duplicate responses are collapsed.
- [ ] Manual add remains available when discovery finds nothing.

## Manual Test Connection

Add a true per-device test, separate from service refresh.

Implementation direction:

- Add a Tauri command such as `test_receiver_connection(host, port)`.
- It should attempt a TCP connection to `host:port` with a short timeout.
- Prefer also sending a minimal eISCP query such as `PWRQSTN` if practical, but TCP reachability is acceptable for the first pass if clearly labeled.
- Return structured result:

```ts
type TestConnectionResult = {
  ok: boolean;
  message: string;
  latencyMs?: number;
  model?: string;
};
```

Acceptance:

- [ ] Each saved, manual, or discovered device can be tested.
- [ ] Online result is visible and timestamped.
- [ ] Offline/error result is visible and actionable.
- [ ] Testing a device does not automatically switch the active device.

## Device CRUD

### Add Device

Fields:

- Name, default `CR-N775` or discovered model.
- Host/IP.
- Port, default `60128`.

Acceptance:

- [ ] User can add a manual device.
- [ ] Host is required.
- [ ] Port defaults to `60128`.
- [ ] Duplicate `host:port` is blocked or updates the existing device.

### Edit Device

Acceptance:

- [ ] User can edit name, host, and port.
- [ ] Editing the active device updates sidecar config after save/apply.
- [ ] Invalid host/port cannot be saved.

### Delete Device

Acceptance:

- [ ] User can delete a non-active device.
- [ ] Deleting the active device requires confirmation.
- [ ] If active device is deleted, the app clearly moves to no-device-selected state or selects another saved device intentionally.

### Use Device

Acceptance:

- [ ] User can set any saved or discovered device as active.
- [ ] Active device is persisted.
- [ ] Local service restarts/reconfigures using the active device host and port.
- [ ] UI returns to connected/receiver-offline state based on actual connection.

## Settings UI Structure

Keep Settings compact and task-oriented.

Suggested layout:

1. Header:
   - Back button.
   - `Settings`.
   - Service/receiver status summary.

2. Active Device section:
   - Device name.
   - Host and port.
   - Status: online/offline/untested.
   - Buttons: `Test`, `Edit`, `Remove`.

3. Devices section:
   - Saved devices list.
   - Discovered devices list after scan.
   - Buttons: `Scan LAN`, `Add`.

4. Advanced section:
   - Service mode.
   - External URL.
   - Mock mode.
   - Shortcuts.

UI cleanup required:

- Fix oversized checkbox styling.
- Avoid horizontal scroll.
- Keep vertical scrolling inside the popover only when needed.
- Keep buttons stable and readable at the current popover width.
- Avoid putting every setting in one long undifferentiated form.

## Recommended Implementation Phases

### Phase 1: Data And Store Compatibility

- [x] Extend shared/frontend config types with `ReceiverDevice`.
- [x] Add store migration from existing `localConfig.host`.
- [x] Add `get_service_config` response with devices and active device.
- [x] Ensure `update_service_config` persists devices and active device.
- [x] Ensure sidecar env uses active device host/port.

### Phase 2: Manual Device CRUD

- [x] Build Add Device form.
- [x] Build Edit Device form.
- [x] Build Delete Device confirmation.
- [x] Build Use Device action.
- [x] Add per-device validation.

### Phase 3: Manual Test Connection

- [x] Add Tauri `test_receiver_connection`.
- [x] Add UI test buttons and per-device test result state.
- [x] Persist last test status/time.

### Phase 4: LAN Discovery

- [x] Add Tauri `discover_onkyo_devices`.
- [x] Implement UDP discovery with timeout.
- [x] Parse and de-duplicate responses.
- [x] Show discovered device results.
- [x] Allow saving discovered devices.

### Phase 5: Settings UI Polish

- [x] Reorganize Settings into Active Device, Devices, and Advanced sections.
- [x] Fix checkbox sizing.
- [x] Remove horizontal overflow.
- [x] Verify text does not overlap at current popover size.
- [x] Keep shortcuts visible but lower priority.

### Phase 6: Verification

- [x] Run `git diff --check`.
- [x] Run `npm test`.
- [x] Run `npm run test:integration`.
- [x] Run `npm run build:app`.
- [x] Smoke test sidecar in mock mode.
- [x] Verify Settings manually in Tauri dev shell.
- [x] Verify discovery against a real CR-N775 if available.

## Acceptance Criteria

Settings tab is complete when:

- [ ] User can scan LAN for Onkyo devices.
- [ ] User can add a device manually.
- [ ] User can edit a saved device.
- [ ] User can delete a saved device.
- [ ] User can manually test any device.
- [ ] User can set one device as active.
- [ ] Active device persists after app restart.
- [ ] Active device host/port are used by the local sidecar.
- [ ] App handles no devices, no discovery results, offline device, and invalid input gracefully.
- [ ] Settings layout has no horizontal scrollbar and no oversized controls.
- [ ] Existing core controls still work after choosing a device.

## Out Of Scope

Do not implement in this task:

- NAS/USB music browsing.
- Album art.
- Multi-zone support.
- Raycast extension updates.
- Docker/N100 deployment.
- Cloud sync of devices.
- Multiple simultaneous receiver connections.
- Full receiver capability database.

## Notes For Agent

- Prefer Tauri Rust commands for LAN discovery and TCP connection tests because browser JavaScript cannot reliably perform UDP broadcast or raw TCP tests.
- Keep existing service API stable unless a change is required for device switching.
- Make device switching explicit. Discovery should never silently change the active receiver.
- If discovery does not work in the local network, the manual add path must still be excellent.
