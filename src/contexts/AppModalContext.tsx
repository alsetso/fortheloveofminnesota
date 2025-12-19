'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useAppModals, UseAppModalsReturn } from '@/hooks/useAppModals';
import GlobalModals from '@/components/GlobalModals';

const AppModalContext = createContext<UseAppModalsReturn | null>(null);

export function AppModalProvider({ children }: { children: ReactNode }) {
  const modals = useAppModals();
  
  return (
    <AppModalContext.Provider value={modals}>
      {children}
      {/* Global modals rendered at app level - works on all pages */}
      <GlobalModals />
    </AppModalContext.Provider>
  );
}

export function useAppModalContext(): UseAppModalsReturn {
  const context = useContext(AppModalContext);
  
  if (!context) {
    throw new Error('useAppModalContext must be used within AppModalProvider');
  }
  
  return context;
}

// Safe version that returns no-op functions when outside provider
export function useAppModalContextSafe(): UseAppModalsReturn {
  const context = useContext(AppModalContext);
  
  if (!context) {
    return {
      modal: { type: 'none' },
      isModalOpen: false,
      openWelcome: () => {},
      openOnboarding: () => {},
      openAccount: () => {},
      openUpgrade: () => {},
      openIntelligence: () => {},
      openAnalytics: () => {},
      openAtlas: () => {},
      openComingSoon: () => {},
      closeModal: () => {},
      getIntelligenceContext: () => null,
      getAtlasContext: () => undefined,
    };
  }
  
  return context;
}
