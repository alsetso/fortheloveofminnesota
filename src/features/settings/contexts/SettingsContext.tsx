'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ProfileAccount } from '@/types/profile';

interface SettingsContextValue {
  account: ProfileAccount;
  userEmail: string;
  /** Map limit from accounts.plan (server-side): hobby=1, contributor=5, etc. */
  mapLimit: number;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  account,
  userEmail,
  mapLimit,
  children,
}: {
  account: ProfileAccount;
  userEmail: string;
  mapLimit: number;
  children: ReactNode;
}) {
  return (
    <SettingsContext.Provider value={{ account, userEmail, mapLimit }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used within SettingsProvider');
  return value;
}
