import type { PresetDefinition } from '@o-control/shared';
import { COMMANDS, buildVolumeCommand, buildInputCommand } from '@o-control/eiscp';
import { INPUT_CODES } from '@o-control/shared';

/**
 * Default preset definitions.
 * Each preset is a sequence of eISCP commands with optional delays.
 */
export const DEFAULT_PRESETS: PresetDefinition[] = [
  {
    id: 'work-jazz',
    name: 'Work Jazz',
    description: 'Power on, switch to NET input, set volume to comfortable level for work',
    steps: [
      { command: COMMANDS.POWER_ON, delayMs: 500 },
      { command: buildInputCommand(INPUT_CODES.net), delayMs: 300 },
      { command: buildVolumeCommand(22), delayMs: 200 },
      { command: COMMANDS.MUTE_OFF },
    ],
  },
  {
    id: 'focus-quiet',
    name: 'Focus Quiet',
    description: 'Lower volume for focused work, unmute',
    steps: [
      { command: buildVolumeCommand(12), delayMs: 200 },
      { command: COMMANDS.MUTE_OFF },
    ],
  },
  {
    id: 'stop',
    name: 'Stop',
    description: 'Stop playback and set receiver to standby',
    steps: [
      { command: COMMANDS.NET_STOP, delayMs: 300 },
      { command: COMMANDS.POWER_OFF },
    ],
  },
];

/**
 * Load presets. Currently returns built-in defaults.
 * Future: could load from a user config file.
 */
export function loadPresets(): PresetDefinition[] {
  return [...DEFAULT_PRESETS];
}

/**
 * Find a preset by its ID.
 */
export function findPreset(id: string): PresetDefinition | undefined {
  return DEFAULT_PRESETS.find((p) => p.id === id);
}
