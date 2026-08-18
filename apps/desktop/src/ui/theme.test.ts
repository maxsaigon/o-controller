import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, useThemePreference } from './theme';

describe('useThemePreference', () => {
  const storedValues = new Map<string, string>();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => storedValues.clear(),
        getItem: (key: string) => storedValues.get(key) ?? null,
        setItem: (key: string, value: string) => storedValues.set(key, value),
      },
    });
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('defaults to macOS appearance and applies it to the document', () => {
    const { result } = renderHook(() => useThemePreference());

    expect(result.current[0]).toBe('auto');
    expect(document.documentElement.dataset.theme).toBe('auto');
  });

  it('persists an explicit appearance choice', () => {
    const { result } = renderHook(() => useThemePreference());

    act(() => result.current[1]('dark'));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
