import { useEffect, useState } from 'react';

export type ThemePreference = 'auto' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'o-control-theme';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}

function themeStorage(): Storage | null {
  try {
    return globalThis.window?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getStoredThemePreference(): ThemePreference {
  const stored = themeStorage()?.getItem(THEME_STORAGE_KEY) ?? null;
  return isThemePreference(stored) ? stored : 'auto';
}

export function applyThemePreference(theme: ThemePreference): void {
  document.documentElement.dataset.theme = theme;
}

export function initializeThemePreference(): ThemePreference {
  const theme = getStoredThemePreference();
  applyThemePreference(theme);
  return theme;
}

export function useThemePreference(): readonly [ThemePreference, (theme: ThemePreference) => void] {
  const [theme, setTheme] = useState<ThemePreference>(getStoredThemePreference);

  useEffect(() => {
    applyThemePreference(theme);
  }, [theme]);

  function updateTheme(nextTheme: ThemePreference) {
    themeStorage()?.setItem(THEME_STORAGE_KEY, nextTheme);
    applyThemePreference(nextTheme);
    setTheme(nextTheme);
  }

  return [theme, updateTheme] as const;
}
