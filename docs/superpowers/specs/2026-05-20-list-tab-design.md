# List Tab Navigation and Music Server Browsing Design Specification

This document details the design for the new "List Tab" in the O-Control desktop application. It replaces the legacy "More" tab, enabling users to browse files and folders on a Music Server (DLNA/USB) using eISCP network commands.

## 1. Objectives

- **Replace "More" Tab:** Eliminate the legacy "More" tab (Presets) in the command bar and replace it with a dedicated "List" tab.
- **Display Folder Tracks:** Display the list of music files within the current folder for selection and playback.
- **Navigate Folders:** Allow users to browse subfolders and go back to parent directories.
- **Music Server Support:** Target the `NET` (specifically Music Server / NAS) and `USB` sources.
- **Robust Mock Mode:** Ensure the browsing and playback flows can be fully tested in mock mode without physical hardware.

---

## 2. Technical Architecture

### 2.1 eISCP Protocol Commands
Navigating network lists on Onkyo/Integra receivers relies on stateful `NLS` (Net List Select), `NLA` (Net List Action), and `NLT` (Net List Title) commands:
- **`NLT` (Net List Title):** Received from the receiver to inform the client of the current directory title.
- **`NLS` (Net List Select/Info):** 
  - **`NLSU<line_index><separator><text>` / `NLSA<line_index><separator><text>`:** Received from the receiver. `line_index` is `0-9`. Delimiter `/` indicates a directory folder; `-` indicates a playable file/station.
  - **`NLSC<line_index>`:** Received from the receiver to denote which line currently holds the cursor selection.
  - **`NLSI<padded_index>`:** Sent to the receiver to select an index (1-based, 5-digit padded, e.g. `NLSI00003` for the third item).
- **`NLA` (Net List Action):** 
  - **`NLARET`:** Sent to go back (Return).
  - **`NLAENT`:** Sent to enter the highlighted folder.
  - **`NLAUP` / `NLADN`:** Sent to move the cursor up/down.

---

### 2.2 Shared Data Structure (`packages/shared/src/index.ts`)

We define the net list state models and embed them in the main control state:

```typescript
export interface NetListItem {
  index: number;
  name: string;
  type: 'folder' | 'file' | 'unknown';
}

export interface NetListState {
  title: string;
  items: NetListItem[];
  cursor: number;
}

export interface OControlState {
  // ... existing fields ...
  netList: NetListState;
}
```

---

### 2.3 State Store Reducer (`packages/service/src/state-store.ts`)

The `StateStore` processes incoming eISCP packets:
- **`NLT` Command:** Updates `netList.title`. Clears `netList.items` and resets `netList.cursor = -1` to avoid rendering stale items during transitions.
- **`NLS` Command:**
  - If type is `U` or `A`: Parses line index, checks separator (`/` vs `-`), updates or appends the item to `netList.items`, and sorts by index.
  - If type is `C`: Parses line index and updates `netList.cursor`.
- **Input Switch Reset:** Resets list state to defaults when input changes.

---

### 2.4 Backend API Endpoints (`packages/service/src/server.ts`)

Three endpoints handle interactions:
- **`POST /commands/list/query`:** Triggers `NLTQSTN` and `NLSQSTN` to sync list data.
- **`POST /commands/list/select`:** Takes `{ index: number }` and sends `NLSI` + padded 5-digit index (index + 1) to select a line.
- **`POST /commands/list/navigation`:** Takes `{ action: 'back' }` and sends `NLARET` to navigate up.

---

### 2.5 Frontend Component (`apps/desktop/src/components/NetList.tsx`)

A new React component that renders the list tab:
- **Input Guard:** Displays a warning if active input is not `net` or `usb`. Provides a button to switch input.
- **Interactive Directory:**
  - Header with a back button and the current directory name.
  - Scrollable list of items displaying folder or music icons.
  - Clicking items triggers the select API route.
  - Active item highlights in standard theme blue.
- **Auto-Sync:** Queries list state on component mount.

---

### 2.6 Mock Mode State Machine (`packages/service/src/receiver-client.ts`)

A nested mockup directory structure simulates browsing:
- Root -> `Music Server (NAS)` -> `Folders` -> `Pop Music` -> tracks (e.g. `Khúc Giao Mùa.flac`).
- Intercepts query commands and fires mock eISCP events after brief timeouts.
- Intercepts navigation/selection commands to navigate folders or trigger simulated playing state.

---

## 3. Verification Plan

### 3.1 Mock Verification
1. Boot service and desktop app in Mock Mode.
2. Select **Network** input.
3. Open the **List** tab.
4. Verify root directory titles and folder lists load correctly.
5. Click on **Music Server (NAS)** -> **Folders** -> **Pop Music**. Verify list updates at each step.
6. Click **Back** to navigate up.
7. Click **Khúc Giao Mùa.flac**. Verify the player now-playing metadata updates to show the track playing.

### 3.2 Real Device Verification
1. Run application connected to a real CR-N775 receiver.
2. Select **NET** input.
3. Navigate using the **List** tab.
4. Verify directories and files match the receiver's front-panel display.
