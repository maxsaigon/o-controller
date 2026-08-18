// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const themeCss = readFileSync(new URL('./flat-theme.css', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');

describe('approved flat appearance theme', () => {
  it('loads after the legacy structural stylesheet', () => {
    expect(mainSource.indexOf("./styles/flat-theme.css"))
      .toBeGreaterThan(mainSource.indexOf("./styles/global.css"));
  });

  it('declares matching light and dark semantic palettes', () => {
    expect(themeCss).toContain('color-scheme: light dark');
    expect(themeCss).toContain('--flat-app: #f7f5f1');
    expect(themeCss).toContain('--flat-accent: #215edd');
    expect(themeCss).toContain('@media (prefers-color-scheme: dark)');
    expect(themeCss).toContain('--flat-app: #0b1220');
    expect(themeCss).toContain('--flat-accent: #6b8eff');
    expect(themeCss).toContain(':root[data-theme="light"]');
    expect(themeCss).toContain(':root[data-theme="dark"]');
    expect(themeCss).toContain(':root[data-theme="auto"]');
  });

  it('removes decorative elevation and dividers from primary surfaces', () => {
    expect(themeCss).toMatch(/\.popover,[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/);
    expect(themeCss).toMatch(/\.v2-sidebar \{[\s\S]*?border: 0;/);
    expect(themeCss).toMatch(/\.v2-player-content \.now-playing \{[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/);
    expect(themeCss).toMatch(/\.v2-mini-player \{[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/);
  });

  it('centers and enlarges player artwork without a duplicate heading style', () => {
    expect(themeCss).not.toContain('.now-playing-heading');
    expect(themeCss).toMatch(
      /\.v2-player-content \.now-playing \.artwork-container \{[\s\S]*?width: min\(100%, clamp\(380px, 58vh, 560px\)\);[\s\S]*?margin: 0 auto;/,
    );
  });
});
