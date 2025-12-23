'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface DraftPOI {
  id: string;
  lat: number;
  lng: number;
  name: string;
  emoji?: string;
  category?: string;
}

interface DraftPOIsContextType {
  draftPOIs: DraftPOI[];
  setDraftPOIs: (pois: DraftPOI[] | ((prev: DraftPOI[]) => DraftPOI[])) => void;
}

const DraftPOIsContext = createContext<DraftPOIsContextType | undefined>(undefined);

export function DraftPOIsProvider({ children }: { children: ReactNode }) {
  const [draftPOIs, setDraftPOIs] = useState<DraftPOI[]>([]);

  return (
    <DraftPOIsContext.Provider value={{ draftPOIs, setDraftPOIs }}>
      {children}
    </DraftPOIsContext.Provider>
  );
}

export function useDraftPOIs() {
  const context = useContext(DraftPOIsContext);
  if (context === undefined) {
    throw new Error('useDraftPOIs must be used within a DraftPOIsProvider');
  }
  return context;
}

