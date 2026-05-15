import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRESETS,
  loadPresets,
  findPreset,
} from './presets.js';
import { COMMANDS } from '@o-control/eiscp';

// Preset definitions

describe('Preset definitions', () => {
  it('should have exactly 3 default presets', () => {
    assert.equal(DEFAULT_PRESETS.length, 3);
  });

  it('should have unique IDs', () => {
    const ids = DEFAULT_PRESETS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('should have non-empty names and descriptions', () => {
    for (const preset of DEFAULT_PRESETS) {
      assert.ok(preset.name.length > 0, `Preset ${preset.id} has empty name`);
      assert.ok(preset.description.length > 0, `Preset ${preset.id} has empty description`);
    }
  });

  it('should have at least one step per preset', () => {
    for (const preset of DEFAULT_PRESETS) {
      assert.ok(preset.steps.length > 0, `Preset ${preset.id} has no steps`);
    }
  });

  it('should have non-empty command strings in all steps', () => {
    for (const preset of DEFAULT_PRESETS) {
      for (const step of preset.steps) {
        assert.ok(step.command.length > 0, `Preset ${preset.id} has step with empty command`);
      }
    }
  });
});

// Command order: Work Jazz

describe('Work Jazz preset command order', () => {
  const preset = DEFAULT_PRESETS.find((p) => p.id === 'work-jazz')!;

  it('should exist', () => {
    assert.ok(preset);
  });

  it('should power on first', () => {
    assert.equal(preset.steps[0].command, COMMANDS.POWER_ON);
  });

  it('should switch input second', () => {
    assert.ok(preset.steps[1].command.startsWith('SLI'), 'Second step should be input switch');
  });

  it('should set volume third', () => {
    assert.ok(preset.steps[2].command.startsWith('MVL'), 'Third step should be volume set');
  });

  it('should unmute last', () => {
    assert.equal(preset.steps[3].command, COMMANDS.MUTE_OFF);
  });

  it('should have delay after power on (receiver boot)', () => {
    assert.ok(
      (preset.steps[0].delayMs ?? 0) >= 200,
      'Power on should have substantial delay for receiver boot',
    );
  });
});

// Command order: Focus Quiet

describe('Focus Quiet preset command order', () => {
  const preset = DEFAULT_PRESETS.find((p) => p.id === 'focus-quiet')!;

  it('should exist', () => {
    assert.ok(preset);
  });

  it('should set volume first', () => {
    assert.ok(preset.steps[0].command.startsWith('MVL'), 'First step should set volume');
  });

  it('should unmute last', () => {
    assert.equal(preset.steps[preset.steps.length - 1].command, COMMANDS.MUTE_OFF);
  });

  it('should not touch power (no PWR command)', () => {
    const hasPower = preset.steps.some((s) => s.command.startsWith('PWR'));
    assert.equal(hasPower, false, 'Focus Quiet should not change power state');
  });
});

// Command order: Stop

describe('Stop preset command order', () => {
  const preset = DEFAULT_PRESETS.find((p) => p.id === 'stop')!;

  it('should exist', () => {
    assert.ok(preset);
  });

  it('should stop playback first', () => {
    assert.equal(preset.steps[0].command, COMMANDS.NET_STOP);
  });

  it('should power off last (standby is an explicit action)', () => {
    assert.equal(preset.steps[preset.steps.length - 1].command, COMMANDS.POWER_OFF);
  });

  it('should have delay between stop and power off', () => {
    assert.ok(
      (preset.steps[0].delayMs ?? 0) >= 100,
      'Should wait for playback to stop before powering off',
    );
  });
});

// loadPresets

describe('loadPresets', () => {
  it('should return a fresh copy', () => {
    const a = loadPresets();
    const b = loadPresets();
    assert.notEqual(a, b, 'Should return a new array each call');
    assert.deepEqual(a, b, 'Content should be identical');
  });
});

// findPreset

describe('findPreset', () => {
  it('should find work-jazz', () => {
    const preset = findPreset('work-jazz');
    assert.ok(preset);
    assert.equal(preset.id, 'work-jazz');
  });

  it('should find focus-quiet', () => {
    const preset = findPreset('focus-quiet');
    assert.ok(preset);
  });

  it('should find stop', () => {
    const preset = findPreset('stop');
    assert.ok(preset);
  });

  it('should return undefined for unknown id', () => {
    const preset = findPreset('nonexistent');
    assert.equal(preset, undefined);
  });

  it('should return undefined for empty string', () => {
    const preset = findPreset('');
    assert.equal(preset, undefined);
  });
});
