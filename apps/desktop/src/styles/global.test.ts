// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./global.css', import.meta.url), 'utf8');
const rules = Array.from(
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(/([^{}]+)\{([^{}]*)\}/g),
  ([, selectorText, declarationText]) => ({
    selectors: selectorText.split(',').map((selector) => selector.trim()),
    declarations: new Map(
      declarationText
        .split(';')
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .map((declaration) => {
          const separator = declaration.indexOf(':');
          return [
            declaration.slice(0, separator).trim(),
            declaration.slice(separator + 1).trim().replace(/\s+/g, ' '),
          ];
        }),
    ),
  }),
);

function declarationFor(selector: string, property: string): string {
  let value: string | undefined;

  for (const rule of rules) {
    if (rule.selectors.includes(selector) && rule.declarations.has(property)) {
      value = rule.declarations.get(property);
    }
  }

  expect(value, `${selector} must declare ${property}`).toBeDefined();
  return value as string;
}

function declarationForSelectorList(selectors: string[], property: string): string {
  const rule = rules.find((candidate) => (
    candidate.selectors.length === selectors.length
    && candidate.selectors.every((selector, index) => selector === selectors[index])
  ));
  const value = rule?.declarations.get(property);

  expect(value, `${selectors.join(', ')} must declare ${property}`).toBeDefined();
  return value as string;
}

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

  it('uses the approved translucent status header surface', () => {
    expect(declarationFor('.status-header', 'border-bottom')).toBe('1px solid var(--border)');
    expect(declarationFor('.status-header', 'background')).toBe('rgba(255, 255, 255, 0.82)');
  });

  it('uses the approved foreground for shared controls', () => {
    const selectors = [
      '.header-icon-button',
      '.round-button',
      '.square-button',
      '.primary-play',
      '.ghost-button',
      '.primary-button',
      '.preset-row button',
      '.mute-toggle',
    ];
    expect(declarationForSelectorList(selectors, 'color')).toBe('#3f454c');
  });

  it('uses the approved low-alpha connection halos', () => {
    expect(declarationFor('.status-dot.connected', 'box-shadow')).toBe('0 0 0 3px rgba(39, 166, 83, 0.11)');
    expect(declarationFor('.status-dot.offline', 'box-shadow')).toBe('0 0 0 3px rgba(215, 72, 72, 0.11)');
  });

  it('uses the approved centered artwork and placeholder treatment', () => {
    expect(declarationFor('.artwork-container', 'display')).toBe('grid');
    expect(declarationFor('.artwork-container', 'place-items')).toBe('center');
    expect(declarationFor('.artwork-placeholder', 'display')).toBe('grid');
    expect(declarationFor('.artwork-placeholder', 'place-items')).toBe('center');
    expect(declarationFor('.artwork-placeholder', 'background')).toBe('linear-gradient(145deg, #edf2f6, #c8d2dc)');
    expect(declarationFor('.artwork-placeholder', 'color')).toBe('#54708e');
  });

  it('uses the approved translucent command rail surface', () => {
    expect(declarationFor('.rail-dock', 'border-top')).toBe('1px solid var(--border)');
    expect(declarationFor('.rail-dock', 'background')).toBe('rgba(255, 255, 255, 0.9)');
  });

  it('uses the approved inline error palette', () => {
    expect(declarationFor('.inline-error', 'color')).toBe('#b42318');
    expect(declarationFor('.inline-error', 'background')).toBe('#fff1f0');
  });

  it('uses the approved settings link geometry and palette', () => {
    expect(declarationFor('.settings-link', 'width')).toBe('calc(100% - 28px)');
    expect(declarationFor('.settings-link', 'margin')).toBe('0 14px 12px');
    expect(declarationFor('.settings-link', 'padding')).toBe('12px');
    expect(declarationFor('.settings-link', 'border-radius')).toBe('10px');
    expect(declarationFor('.settings-link', 'border')).toBe('1px solid var(--border)');
    expect(declarationFor('.settings-link', 'color')).toBe('var(--text)');
    expect(declarationFor('.settings-link', 'background')).toBe('var(--surface-raised)');
  });

  it('keeps secondary views and playing rows on the approved light palette', () => {
    for (const selector of ['.settings-view', '.sheet-panel', '.netlist-panel']) {
      expect(declarationFor(selector, 'color')).toBe('var(--text)');
      expect(declarationFor(selector, 'background')).toBe('var(--surface)');
    }
    expect(declarationFor('.netlist-item.playing', 'border-color')).toBe('#8fbdf1');
    expect(declarationFor('.netlist-item.playing', 'color')).toBe('#1265c3');
    expect(declarationFor('.netlist-item.playing', 'background')).toBe('#eaf4ff');
  });
});
