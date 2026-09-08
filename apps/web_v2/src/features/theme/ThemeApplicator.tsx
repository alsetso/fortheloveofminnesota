'use client';

/**
 * Mounts once in Providers — reads localStorage, sets data-theme on <html>,
 * and keeps it in sync whenever the user toggles the preference.
 * No visible output.
 */

import { useEffect, useSyncExternalStore } from 'react';
import {
  getTheme,
  getThemeServer,
  hydrateTheme,
  subscribeTheme,
} from './themeStore';

export function ThemeApplicator() {
  // Hydrate from localStorage + system preference on first client mount
  useEffect(() => {
    hydrateTheme();
  }, []);

  const theme = useSyncExternalStore(subscribeTheme, getTheme, getThemeServer);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return null;
}
