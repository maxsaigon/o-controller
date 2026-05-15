# Raycast Extension Documentation

## Overview

The O-Control Raycast extension provides quick access to receiver controls directly from Raycast on macOS. It communicates exclusively through the O-Control service API — no eISCP protocol logic is duplicated.

## Setup

1. Install the O-Control service and ensure it's running
2. Open Raycast preferences → Extensions → O-Control
3. Set the **Service URL** (default: `http://localhost:8787`)

## Commands

| Command | Mode | Description |
|---------|------|-------------|
| Power Toggle | No View | Toggle receiver power on/off |
| Volume Up | No View | Increase volume by one step |
| Volume Down | No View | Decrease volume by one step |
| Set Volume | No View | Set volume to specific level (0-100) |
| Mute Toggle | No View | Toggle mute on/off |
| Switch Input | List View | Select from available inputs |
| Run Preset | List View | Choose and run a preset |
| Show Status | Detail View | View full receiver state |

## Tips

- Assign hotkeys to frequently used commands (Power Toggle, Volume Up/Down)
- Use "Set Volume" with a specific number for precise control
- "Show Status" provides a quick overview including now-playing info
- All commands show clear error messages if the service is unreachable

## Error Handling

If the O-Control service is not running or unreachable, commands will show a toast notification:
- **"Service Unreachable"** — Check if the service is running
- **"Command Failed"** — The service returned an error

## Development

```bash
cd apps/raycast
npm install
npm run dev
```

This launches the extension in development mode within Raycast.
