# Settings Tab Redesign Design Spec

## Overview
This document specifies the redesign of the settings tab in the O-Control desktop application. The objective is to simplify the settings UI by removing developer-oriented options, removing the shortcuts list view, and consolidating the redundant "Active Device" and "Saved Devices" sections into a single unified list.

## Proposed Changes

### 1. Unified Device List
Instead of displaying the active device card separately from the list of saved devices, they will be combined into a single unified list:
- Header: **Devices** with **Scan LAN** and **+ Add** buttons.
- Device Rows: Displayed inside a shared list container (`.device-list-container`) styled like a table.
- Selection: Clicking on any row will set that device as active.
- Active Indicator: The active device row will have an active visual style (highlighted background) and a colored status indicator dot.
- Actions: Tiny inline icon buttons for **Test**, **Edit**, and **Delete** will be shown on each device row.

### 2. UI Simplification
- **Remove Advanced Section**: Remove the "Service Mode" dropdown (Local vs External URL) and the "Mock Mode" checkbox. The app will default to Local service mode unless modified directly in `settings.json`.
- **Remove Shortcuts Section**: Hide the keyboard shortcut reference table. The keyboard shortcuts will remain registered and functional in the background.

### 3. Layout Optimization
- Convert `.settings-view` styling in `global.css` from grid to flexbox (`display: flex; flex-direction: column; overflow-y: auto;`) to prevent vertical overlap and allow clean, natural scrolling for any list size.
- Clean up unused CSS classes.

## Affected Files

### Frontend Component
- [ServiceSettings.tsx](file:///Volumes/Mac Work/Onkyo-C/apps/desktop/src/components/ServiceSettings.tsx)

### Style Sheet
- [global.css](file:///Volumes/Mac Work/Onkyo-C/apps/desktop/src/styles/global.css)

## Verification Plan
1. Launch the Tauri application.
2. Navigate to the Settings view.
3. Verify that the layout is clean, no text overlaps, and scrollable.
4. Scan the LAN for devices and manually add a new device to ensure both functionalities work.
5. Select a device and verify that it becomes active and connection tests successfully.
6. Delete a device and verify it is removed from the list.
