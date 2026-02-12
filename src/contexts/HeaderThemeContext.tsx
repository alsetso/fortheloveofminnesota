'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface HeaderThemeValue {
  /** True when header uses default iOS light gray background (#F2F2F7) */
  isDefaultLightBg: boolean;
  /** True when header should use white background (e.g. when search is active on /maps) */
  isSearchActive: boolean;
}

const HeaderThemeContext = createContext<HeaderThemeValue | null>(null);

export function HeaderThemeProvider({
  value,
  children,
}: {
  value: HeaderThemeValue;
  children: ReactNode;
}) {
  return (
    <HeaderThemeContext.Provider value={value}>
      {children}
    </HeaderThemeContext.Provider>
  );
}

export function useHeaderTheme(): HeaderThemeValue {
  const ctx = useContext(HeaderThemeContext);
  return ctx ?? { isDefaultLightBg: false, isSearchActive: false };
}
