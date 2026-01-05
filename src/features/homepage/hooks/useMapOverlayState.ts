'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MobileNavTab } from '@/components/layout/MobileNavTabs';

export type PopupType = 'pin' | 'atlas' | 'location' | null;

export interface PopupData {
  type: PopupType;
  data: any;
}

export interface MapOverlayState {
  activeTab: MobileNavTab | null;
  popup: PopupData;
}

/**
 * Unified state management for map overlays (mobile nav sheets and entity popups)
 * 
 * Rules:
 * - Only one overlay can be open at a time
 * - Popup has priority over mobile nav (popup can cover nav)
 * - Opening mobile nav closes popup
 * - Opening popup closes mobile nav
 * - Clicking outside closes everything
 */
export function useMapOverlayState() {
  const [state, setState] = useState<MapOverlayState>({
    activeTab: null,
    popup: { type: null, data: null },
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Open mobile nav tab (closes popup)
  const openTab = useCallback((tab: MobileNavTab) => {
    setState(prev => {
      // If clicking the same tab, close it
      if (prev.activeTab === tab) {
        return {
          activeTab: null,
          popup: prev.popup,
        };
      }
      // Open tab and close popup
      return {
        activeTab: tab,
        popup: { type: null, data: null },
      };
    });
  }, []);

  // Close mobile nav tab
  const closeTab = useCallback(() => {
    setState(prev => ({
      ...prev,
      activeTab: null,
    }));
  }, []);

  // Open popup (closes mobile nav)
  const openPopup = useCallback((type: PopupType, data: any) => {
    setState(prev => ({
      activeTab: null, // Close mobile nav when popup opens
      popup: { type, data },
    }));
  }, []);

  // Close popup
  const closePopup = useCallback(() => {
    setState(prev => ({
      ...prev,
      popup: { type: null, data: null },
    }));
  }, []);

  // Close all overlays
  const closeAll = useCallback(() => {
    setState({
      activeTab: null,
      popup: { type: null, data: null },
    });
  }, []);

  // Check if any overlay is open
  const isAnyOverlayOpen = state.activeTab !== null || state.popup.type !== null;

  return {
    state,
    openTab,
    closeTab,
    openPopup,
    closePopup,
    closeAll,
    isAnyOverlayOpen,
  };
}

