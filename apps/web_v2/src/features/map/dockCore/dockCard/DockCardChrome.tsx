'use client';

/**
 * Chrome registration for in-dock cards.
 *
 * The host (DockCardPopover) owns the single scroll surface — matching dock
 * panes. Cards register sticky header/footer + content width via DockCardShell;
 * they never create their own vertical scroller.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type DockCardContentWidth = 'sm' | 'sheet';

export type DockCardChromeState = {
  header: ReactNode | null;
  footer: ReactNode | null;
  contentWidth: DockCardContentWidth;
  /** Optional suffix appended to the host scrollKey (e.g. profile view). */
  scrollKey: string | null;
};

const EMPTY_CHROME: DockCardChromeState = {
  header: null,
  footer: null,
  contentWidth: 'sm',
  scrollKey: null,
};

type DockCardChromeContextValue = {
  chrome: DockCardChromeState;
  setChrome: (next: Partial<DockCardChromeState>) => void;
  resetChrome: () => void;
};

const DockCardChromeContext = createContext<DockCardChromeContextValue | null>(
  null,
);

export function DockCardChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<DockCardChromeState>(EMPTY_CHROME);

  const setChrome = useCallback((next: Partial<DockCardChromeState>) => {
    setChromeState((prev) => ({ ...prev, ...next }));
  }, []);

  const resetChrome = useCallback(() => {
    setChromeState(EMPTY_CHROME);
  }, []);

  const value = useMemo(
    () => ({ chrome, setChrome, resetChrome }),
    [chrome, setChrome, resetChrome],
  );

  return (
    <DockCardChromeContext.Provider value={value}>
      {children}
    </DockCardChromeContext.Provider>
  );
}

export function useDockCardChrome(): DockCardChromeContextValue {
  const ctx = useContext(DockCardChromeContext);
  if (!ctx) {
    throw new Error('useDockCardChrome must be used within DockCardChromeProvider');
  }
  return ctx;
}
