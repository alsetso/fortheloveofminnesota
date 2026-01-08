'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MobileNavTab } from '@/components/layout/MobileNavTabs';
import { PopupType } from './useMapOverlayState';

/**
 * All modal/popup types on the /live page
 * Priority order (highest to lowest):
 * 1. Top-level modals (account, mapStyles, dynamicSearch) - highest priority
 * 2. Entity popups (pin, atlas, location) - high priority
 * 3. Create sheet - medium priority
 * 4. Mobile nav tabs (news, contribute) - lowest priority
 */
export type LivePageModalType =
  | 'account'           // LiveAccountModal
  | 'mapStyles'         // MapStylesPopup
  | 'dynamicSearch'     // DynamicSearchModal
  | `popup-${PopupType}` // 'popup-pin' | 'popup-atlas' | 'popup-location'
  | 'create'            // CreateMentionPopup
  | MobileNavTab        // 'news' | 'contribute'
  | null;

export interface LivePageModalState {
  type: LivePageModalType;
  data?: any;  // Data for popups/modals
}

/**
 * Unified state management for all modals and popups on the /live page
 * 
 * Rules:
 * - Only one modal/popup can be open at a time
 * - Opening a modal closes any currently open modal
 * - Opening the same modal type toggles it closed
 * - Global modals (via AppModalContext) can coexist
 */
export function useLivePageModals() {
  const [modal, setModal] = useState<LivePageModalState>({
    type: null,
    data: null,
  });

  const modalRef = useRef(modal);
  useEffect(() => {
    modalRef.current = modal;
  }, [modal]);

  // Open top-level modal (closes everything)
  const openAccount = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'account') {
        return { type: null, data: null };
      }
      return { type: 'account', data: null };
    });
  }, []);

  const openMapStyles = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'mapStyles') {
        return { type: null, data: null };
      }
      return { type: 'mapStyles', data: null };
    });
  }, []);

  const openDynamicSearch = useCallback((data?: any, type?: 'news' | 'people') => {
    setModal(prev => {
      if (prev.type === 'dynamicSearch') {
        return { type: null, data: null };
      }
      return { type: 'dynamicSearch', data: { ...data, searchType: type } };
    });
  }, []);

  // Open entity popup (closes everything except top-level modals)
  const openPopup = useCallback((type: PopupType, data: any) => {
    setModal(prev => {
      // Don't close top-level modals
      if (prev.type === 'account' || prev.type === 'mapStyles' || prev.type === 'dynamicSearch') {
        return prev;
      }
      const popupType = `popup-${type}` as LivePageModalType;
      if (prev.type === popupType) {
        return { type: null, data: null };
      }
      return { type: popupType, data };
    });
  }, []);

  // Open create sheet (closes tabs and popups, but not top-level modals)
  const openCreate = useCallback((data?: any) => {
    setModal(prev => {
      // Don't close top-level modals
      if (prev.type === 'account' || prev.type === 'mapStyles' || prev.type === 'dynamicSearch') {
        return prev;
      }
      if (prev.type === 'create') {
        return { type: null, data: null };
      }
      return { type: 'create', data };
    });
  }, []);

  // Open mobile nav tab (closes other tabs, popups, create, but not top-level modals)
  const openTab = useCallback((tab: MobileNavTab) => {
    setModal(prev => {
      // Don't close top-level modals
      if (prev.type === 'account' || prev.type === 'mapStyles' || prev.type === 'dynamicSearch') {
        return prev;
      }
      if (prev.type === tab) {
        return { type: null, data: null };
      }
      return { type: tab, data: null };
    });
  }, []);

  // Close specific modal types
  const closeAccount = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'account') {
        return { type: null, data: null };
      }
      return prev;
    });
  }, []);

  const closeMapStyles = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'mapStyles') {
        return { type: null, data: null };
      }
      return prev;
    });
  }, []);

  const closeDynamicSearch = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'dynamicSearch') {
        return { type: null, data: null };
      }
      return prev;
    });
  }, []);

  const closePopup = useCallback(() => {
    setModal(prev => {
      if (prev.type?.startsWith('popup-')) {
        return { type: null, data: null };
      }
      return prev;
    });
  }, []);

  const closeCreate = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'create') {
        return { type: null, data: null };
      }
      return prev;
    });
  }, []);

  const closeTab = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'news' || prev.type === 'contribute') {
        return { type: null, data: null };
      }
      return prev;
    });
  }, []);

  // Close all modals
  const closeAll = useCallback(() => {
    setModal({ type: null, data: null });
  }, []);

  // Helper: Check if specific modal is open
  const isModalOpen = useCallback((type: LivePageModalType) => {
    return modal.type === type;
  }, [modal.type]);

  // Helper: Check if any modal is open
  const isAnyModalOpen = modal.type !== null;

  // Helper: Get current active tab (if a tab is open)
  const activeTab: MobileNavTab | null = 
    modal.type === 'news' || modal.type === 'contribute'
      ? modal.type
      : null;

  // Helper: Get current popup data (if a popup is open)
  const popupData = modal.type?.startsWith('popup-')
    ? {
        type: modal.type.replace('popup-', '') as PopupType,
        data: modal.data,
      }
    : { type: null, data: null };

  // Helper: Check if account modal is open
  const isAccountModalOpen = modal.type === 'account';

  return {
    modal,
    activeTab,
    popupData,
    isAccountModalOpen,
    isAnyModalOpen,
    // Open functions
    openAccount,
    openMapStyles,
    openDynamicSearch,
    openPopup,
    openCreate,
    openTab,
    // Close functions
    closeAccount,
    closeMapStyles,
    closeDynamicSearch,
    closePopup,
    closeCreate,
    closeTab,
    closeAll,
    // Check functions
    isModalOpen,
  };
}

