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

function ruleIndexForSelectorList(selectors: string[]): number {
  const index = rules.findIndex((candidate) => (
    candidate.selectors.length === selectors.length
    && candidate.selectors.every((selector, selectorIndex) => selector === selectors[selectorIndex])
  ));

  expect(index, `${selectors.join(', ')} must have a rule`).toBeGreaterThanOrEqual(0);
  return index;
}

function lastRuleIndexForSelector(selector: string): number {
  let index = -1;

  rules.forEach((rule, ruleIndex) => {
    if (rule.selectors.includes(selector)) index = ruleIndex;
  });

  expect(index, `${selector} must have a rule`).toBeGreaterThanOrEqual(0);
  return index;
}

function classLikeSpecificity(selector: string): number {
  return selector.match(/\.[\w-]+|:(?!:)[\w-]+/g)?.length ?? 0;
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/.{2}/g);
    expect(channels, `${hex} must be a six-digit hex color`).toHaveLength(3);
    const [red, green, blue] = (channels as string[])
      .map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) => channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };

  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

describe('desktop native layout tokens', () => {
  it.each([
    ['--popover-width', '390px'],
    ['--popover-height', '728px'],
    ['--artwork-size', '340px'],
    ['--player-padding', '24px'],
    ['--artwork-gap', '18px'],
    ['color-scheme', 'light'],
    ['--surface', '#f7f7f9'],
    ['--surface-muted', '#eef0f3'],
    ['--accent', '#1677e8'],
    ['--connected', '#27a653'],
    ['--offline', '#d74848'],
    ['--connected-text', '#137a37'],
    ['--offline-text', '#b42318'],
    ['--accent-strong', '#1265c3'],
  ])('declares :root %s as %s', (property, value) => {
    expect(declarationFor(':root', property)).toBe(value);
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

  it('keeps the NetList border box inside its inherited sheet margins', () => {
    expect(declarationFor('.netlist-panel', 'width')).toBe('auto');
    expect(declarationFor('.netlist-panel', 'margin')).toBe('0 10px 10px');
    expect(declarationFor('.netlist-panel', 'box-sizing')).toBe('border-box');
  });

  it('preserves the phrasing wrapper as the flexible DLNA metadata column', () => {
    expect(declarationFor('.netlist-item-text-group', 'display')).toBe('flex');
    expect(declarationFor('.netlist-item-text-group', 'flex-direction')).toBe('column');
    expect(declarationFor('.netlist-item-text-group', 'flex')).toBe('1');
    expect(declarationFor('.netlist-item-text-group', 'min-width')).toBe('0');
  });

  it('uses accessible text colors without changing brand and dot colors', () => {
    const surfaceMuted = declarationFor(':root', '--surface-muted');
    const connectedText = declarationFor(':root', '--connected-text');
    const offlineText = declarationFor(':root', '--offline-text');
    const accentStrong = declarationFor(':root', '--accent-strong');

    expect(contrastRatio(connectedText, surfaceMuted)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(offlineText, surfaceMuted)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', accentStrong)).toBeGreaterThanOrEqual(4.5);
    expect(declarationFor('.status-pill.connected', 'color')).toBe('var(--connected-text)');
    expect(declarationFor('.status-pill.offline', 'color')).toBe('var(--offline-text)');
    expect(declarationFor('.status-pill.connected .status-dot', 'color')).toBe('var(--connected)');
    expect(declarationFor('.status-pill.offline .status-dot', 'color')).toBe('var(--offline)');
    expect(declarationFor('.primary-play', 'background')).toBe('var(--accent-strong)');
    expect(declarationFor('.primary-button', 'background')).toBe('var(--accent-strong)');
    expect(declarationForSelectorList(
      ['.header-icon-button.power.active', '.command-rail button.active'],
      'color',
    )).toBe('var(--accent-strong)');
  });

  it('aligns the settings link with its direct-child peers without clipping', () => {
    expect(declarationFor('.settings-view', 'padding')).toBe('12px 0 14px');
    expect(declarationFor('.settings-view > :not(.settings-link)', 'margin-left')).toBe('14px');
    expect(declarationFor('.settings-view > :not(.settings-link)', 'margin-right')).toBe('14px');
    expect(declarationFor('.settings-link', 'width')).toBe('calc(100% - 28px)');
    expect(declarationFor('.settings-link', 'margin')).toBe('0 14px 12px');
  });

  it('places selected hover treatments after generic hover rules with higher specificity', () => {
    const selectedHoverSelectors = [
      '.input-grid button.selected:hover',
      '.netlist-tab.active:hover',
      '.netlist-item.selected:hover',
      '.netlist-item.playing:hover',
    ];
    const genericHoverSelectors = [
      '.input-grid button:hover',
      '.netlist-tab:hover',
      '.netlist-item:hover',
      '.netlist-item:hover',
    ];
    const selectedHoverIndex = ruleIndexForSelectorList(selectedHoverSelectors);

    expect(declarationForSelectorList(selectedHoverSelectors, 'border-color')).toBe('#8fbdf1');
    expect(declarationForSelectorList(selectedHoverSelectors, 'color')).toBe('#1265c3');
    expect(declarationForSelectorList(selectedHoverSelectors, 'background')).toBe('#eaf4ff');
    selectedHoverSelectors.forEach((selector, index) => {
      expect(selectedHoverIndex).toBeGreaterThan(lastRuleIndexForSelector(genericHoverSelectors[index]));
      expect(classLikeSpecificity(selector)).toBeGreaterThan(classLikeSpecificity(genericHoverSelectors[index]));
    });
  });
});
