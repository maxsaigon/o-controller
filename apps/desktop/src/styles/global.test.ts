// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./global.css', import.meta.url), 'utf8');

describe('desktop native layout tokens', () => {
  it.each([
    '--popover-width: 390px',
    '--popover-height: 728px',
    '--artwork-size: 340px',
    '--player-padding: 24px',
    '--artwork-gap: 18px',
    'color-scheme: light',
    '--surface: #f7f7f9',
    '--accent: #1677e8',
  ])('includes %s', (token) => {
    expect(css).toContain(token);
  });
});
