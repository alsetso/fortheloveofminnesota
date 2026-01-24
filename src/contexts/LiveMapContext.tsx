'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Mention } from '@/types/mention';

interface LocationPopupData {
  isOpen: boolean;
  lat: number;
  lng: number;
  address: string | null;
  mapMeta: Record<string, any> | null;
  mentionTypeId?: string | null;
  mentionTypeName?: string | null;
}

interface LiveMapContextValue {
  // Selected mention
  selectedMention: Mention | null;
  setSelectedMention: (mention: Mention | null) => void;
  
  // Sheet state
  isMentionSheetOpen: boolean;
  openMentionSheet: () => void;
  closeMentionSheet: () => void;
  
  // Location popup
  locationPopup: LocationPopupData;
  openLocationPopup: (data: Omit<LocationPopupData, 'isOpen'>) => void;
  closeLocationPopup: () => void;
}

const LiveMapContext = createContext<LiveMapContextValue | undefined>(undefined);

export function LiveMapProvider({ children }: { children: ReactNode }) {
  const [selectedMention, setSelectedMention] = useState<Mention | null>(null);
  const [isMentionSheetOpen, setIsMentionSheetOpen] = useState(false);
  const [locationPopup, setLocationPopup] = useState<LocationPopupData>({
    isOpen: false,
    lat: 0,
    lng: 0,
    address: null,
    mapMeta: null,
  });

  const openMentionSheet = useCallback(() => {
    setIsMentionSheetOpen(true);
  }, []);

  const closeMentionSheet = useCallback(() => {
    setIsMentionSheetOpen(false);
    setSelectedMention(null);
  }, []);

  const openLocationPopup = useCallback((data: Omit<LocationPopupData, 'isOpen'>) => {
    setLocationPopup({
      ...data,
      isOpen: true,
    });
  }, []);

  const closeLocationPopup = useCallback(() => {
    setLocationPopup((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  return (
    <LiveMapContext.Provider
      value={{
        selectedMention,
        setSelectedMention,
        isMentionSheetOpen,
        openMentionSheet,
        closeMentionSheet,
        locationPopup,
        openLocationPopup,
        closeLocationPopup,
      }}
    >
      {children}
    </LiveMapContext.Provider>
  );
}

export function useLiveMapContext() {
  const context = useContext(LiveMapContext);
  if (context === undefined) {
    throw new Error('useLiveMapContext must be used within LiveMapProvider');
  }
  return context;
}
