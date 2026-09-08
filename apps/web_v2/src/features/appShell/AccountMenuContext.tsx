'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type AccountMenuContextValue = {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

const AccountMenuContext = createContext<AccountMenuContextValue | null>(null);

/**
 * App-surface account menu (X-style push). Lives under MapDockProvider so
 * sidebar rows can open dock cards after the stage slides shut.
 */
export function AccountMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((prev) => !prev), []);

  const value = useMemo(
    () => ({ open, openDrawer, closeDrawer, toggleDrawer }),
    [open, openDrawer, closeDrawer, toggleDrawer],
  );

  return (
    <AccountMenuContext.Provider value={value}>
      {children}
    </AccountMenuContext.Provider>
  );
}

export function useAccountMenu(): AccountMenuContextValue {
  const ctx = useContext(AccountMenuContext);
  if (!ctx) {
    throw new Error('useAccountMenu must be used within AccountMenuProvider');
  }
  return ctx;
}

/** Safe for chrome that may render outside the App shell (returns closed stubs). */
export function useAccountMenuSafe(): AccountMenuContextValue {
  const ctx = useContext(AccountMenuContext);
  return (
    ctx ?? {
      open: false,
      openDrawer: () => {},
      closeDrawer: () => {},
      toggleDrawer: () => {},
    }
  );
}
