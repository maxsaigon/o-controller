# Presets Documentation

## Overview

Presets are named sequences of eISCP commands that automate common receiver workflows. Each preset executes its steps in order with configurable delays between steps.

## Built-in Presets

### Work Jazz

**ID:** `work-jazz`

Turns on the receiver, switches to network input (for streaming services), sets volume to a comfortable work level, and unmutes.

| Step | Command | Delay |
|------|---------|-------|
| 1 | `PWR01` (Power On) | 500ms |
| 2 | `SLI2B` (NET Input) | 300ms |
| 3 | `MVL16` (Volume 22) | 200ms |
| 4 | `AMT00` (Unmute) | — |

### Focus Quiet

**ID:** `focus-quiet`

Lowers volume for focused work without changing input or power state.

| Step | Command | Delay |
|------|---------|-------|
| 1 | `MVL0C` (Volume 12) | 200ms |
| 2 | `AMT00` (Unmute) | — |

### Stop

**ID:** `stop`

Stops playback and puts the receiver into standby.

| Step | Command | Delay |
|------|---------|-------|
| 1 | `NTCSTOP` (Stop Playback) | 300ms |
| 2 | `PWR00` (Standby) | — |

## API Usage

### List Presets

```bash
curl http://localhost:8787/presets
```

### Run a Preset

```bash
curl -X POST http://localhost:8787/presets/work-jazz/run
```

## Preset Schema

```typescript
interface PresetDefinition {
  id: string;           // URL-safe identifier
  name: string;         // Human-readable name
  description: string;  // What this preset does
  steps: PresetStep[];  // Ordered command sequence
}

interface PresetStep {
  command: string;      // Raw eISCP command (e.g. 'PWR01')
  delayMs?: number;     // Delay after this step (default: 0)
}
```

## Future Improvements

- User-defined presets via config file
- Conditional steps (e.g., only power on if currently off)
- Confirmation prompts for destructive presets (power off)
- Preset scheduling (e.g., "Stop at 11 PM")
