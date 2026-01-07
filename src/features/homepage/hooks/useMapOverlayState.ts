'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MobileNavTab } from '@/components/layout/MobileNavTabs';

export type PopupType = 'pin' | 'atlas' | 'location';

export type OverlayType = 
  | MobileNavTab  // 'news' | 'contribute'
  | 'create'      // Create sheet (special, opened via "Add Label")
  | `popup-${PopupType}`  // 'popup-pin' | 'popup-atlas' | 'popup-location'
  | null;

export interface OverlayData {
  type: OverlayType;
  data?: any;  // Data for popups (mention, atlas entity, location)
}

/**
 * Unified state management for map overlays
 * 
 * Priority (highest to lowest):
 * 1. Entity popups (popup-pin, popup-atlas, popup-location) - highest priority
 * 2. Create sheet (create) - medium priority
 * 3. Mobile nav tabs (news, contribute) - lowest priority
 * 
 * Rules:
 * - Only one overlay can be open at a time
 * - Opening higher priority overlay closes lower priority ones
 * - Opening same overlay type toggles it closed
 * - Clicking outside closes everything
 */
export function useMapOverlayState() {
  const [overlay, setOverlay] = useState<OverlayData>({
    type: null,
    data: null,
  });

  const overlayRef = useRef(overlay);
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  // Open mobile nav tab (closes popups and create sheet)
  const openTab = useCallback((tab: MobileNavTab) => {
    setOverlay(prev => {
      // If clicking the same tab, close it
      if (prev.type === tab) {
        return { type: null, data: null };
      }
      // Open tab and close everything else
      return { type: tab, data: null };
    });
  }, []);

  // Close mobile nav tab
  const closeTab = useCallback(() => {
    setOverlay(prev => {
      if (prev.type === 'news' || prev.type === 'contribute') {
        return { type: null, data: null };
      }
      return prev;
    });
  }, []);

  // Open create sheet (closes tabs and popups)
  const openCreate = useCallback((data?: any) => {
    setOverlay({ type: 'create', data });
  }, []);

  // Close create sheet
  const closeCreate = useCallback(() => {
    setOverlay(prev => {
      if (prev.type === 'create') {
        return { type: null, data: null };
      }
      return prev;
    });
  }, []);

  // Open entity popup (closes everything - highest priority)
  const openPopup = useCallback((type: PopupType, data: any) => {
    setOverlay({ type: `popup-${type}`, data });
  }, []);

  // Close entity popup
  const closePopup = useCallback(() => {
    setOverlay(prev => {
      if (prev.type?.startsWith('popup-')) {
        return { type: null, data: null };
      }
      return prev;
    });
  }, []);

  // Close all overlays
  const closeAll = useCallback(() => {
    setOverlay({ type: null, data: null });
  }, []);

  // Helper: Check if specific overlay is open
  const isOverlayOpen = useCallback((type: OverlayType) => {
    return overlay.type === type;
  }, [overlay.type]);

  // Helper: Check if any overlay is open
  const isAnyOverlayOpen = overlay.type !== null;

  // Helper: Get current active tab (if a tab is open)
  const activeTab: MobileNavTab | null = 
    overlay.type === 'news' || overlay.type === 'contribute'
      ? overlay.type
      : null;

  // Helper: Get current popup data (if a popup is open)
  const popupData = overlay.type?.startsWith('popup-')
    ? {
        type: overlay.type.replace('popup-', '') as PopupType,
        data: overlay.data,
      }
    : { type: null, data: null };

  return {
    overlay,
    activeTab,
    popupData,
    openTab,
    closeTab,
    openCreate,
    closeCreate,
    openPopup,
    closePopup,
    closeAll,
    isOverlayOpen,
    isAnyOverlayOpen,
  };
}

