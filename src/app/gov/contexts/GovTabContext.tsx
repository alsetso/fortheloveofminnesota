'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type Tab = 'orgs' | 'people' | 'roles';

interface GovTabContextType {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const GovTabContext = createContext<GovTabContextType | undefined>(undefined);

export function GovTabProvider({ children, initialTab = 'orgs' }: { children: ReactNode; initialTab?: Tab }) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  return (
    <GovTabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </GovTabContext.Provider>
  );
}

export function useGovTab() {
  const context = useContext(GovTabContext);
  if (context === undefined) {
    throw new Error('useGovTab must be used within a GovTabProvider');
  }
  return context;
}

