'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MobileNavTab } from '@/components/layout/MobileNavTabs';
import { PopupType } from './useMapOverlayState';

/**
 * All modal/popup types on the /live page
 * Priority order (highest to lowest):
 * 1. Top-level modals (account, mapStyles, dynamicSearch) - highest priority
 * 2. Camera modal - high priority (blocks other interactions)
 * 3. Entity popups (pin, location) - high priority
 * 4. Location permission - medium-high priority
 * 5. Layer record - medium priority
 * 6. Create sheet - medium priority
 * 7. Bottom button popups - low priority
 * 8. Mobile nav tabs (contribute, tools) - lowest priority
 */
export type ModalMode = 'create' | 'edit' | 'view';

export type LivePageModalType =
  | 'account'           // LiveAccountModal
  | 'mapStyles'         // MapStylesPopup
  | 'dynamicSearch'     // DynamicSearchModal
  | 'camera'            // CameraModal
  | 'locationPermission' // LocationPermissionModal
  | 'layerRecord'       // LayerRecordPopup
  | `popup-${PopupType}` // 'popup-pin' | 'popup-location'
  | 'create'            // CreateMentionPopup
  | 'bottomButton-settings'    // BottomButtonsPopup with settings
  | 'bottomButton-analytics'   // BottomButtonsPopup with analytics
  | 'bottomButton-collections' // BottomButtonsPopup with collections
  | 'bottomButton-create'      // BottomButtonsPopup create placeholder
  | MobileNavTab        // 'contribute' | 'tools'
  | null;

export interface LivePageModalState {
  type: LivePageModalType;
  mode?: ModalMode;  // Optional mode for modals that support it
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
    mode: undefined,
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

  // Open camera modal (closes everything except top-level modals)
  const openCamera = useCallback((mode: 'create' | 'edit' = 'create') => {
    setModal(prev => {
      // Don't close top-level modals
      if (prev.type === 'account' || prev.type === 'mapStyles' || prev.type === 'dynamicSearch') {
        return prev;
      }
      if (prev.type === 'camera') {
        return { type: null, mode: undefined, data: null };
      }
      return { type: 'camera', mode, data: null };
    });
  }, []);

  // Close camera modal
  const closeCamera = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'camera') {
        return { type: null, mode: undefined, data: null };
      }
      return prev;
    });
  }, []);

  // Open location permission modal (doesn't close top-level modals)
  const openLocationPermission = useCallback(() => {
    setModal(prev => {
      // Don't close top-level modals
      if (prev.type === 'account' || prev.type === 'mapStyles' || prev.type === 'dynamicSearch') {
        return prev;
      }
      if (prev.type === 'locationPermission') {
        return { type: null, mode: undefined, data: null };
      }
      return { type: 'locationPermission', mode: undefined, data: null };
    });
  }, []);

  // Close location permission modal
  const closeLocationPermission = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'locationPermission') {
        return { type: null, mode: undefined, data: null };
      }
      return prev;
    });
  }, []);

  // Open layer record popup (closes bottom buttons and lower priority modals)
  const openLayerRecord = useCallback((data: any) => {
    setModal(prev => {
      // Don't close top-level modals or camera
      if (prev.type === 'account' || prev.type === 'mapStyles' || prev.type === 'dynamicSearch' || prev.type === 'camera') {
        return prev;
      }
      if (prev.type === 'layerRecord') {
        return { type: null, mode: undefined, data: null };
      }
      return { type: 'layerRecord', mode: undefined, data };
    });
  }, []);

  // Close layer record popup
  const closeLayerRecord = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'layerRecord') {
        return { type: null, mode: undefined, data: null };
      }
      return prev;
    });
  }, []);

  // Open entity popup (closes everything except top-level modals and camera)
  const openPopup = useCallback((type: PopupType, data: any) => {
    setModal(prev => {
      // Don't close top-level modals or camera
      if (prev.type === 'account' || prev.type === 'mapStyles' || prev.type === 'dynamicSearch' || prev.type === 'camera') {
        return prev;
      }
      const popupType = `popup-${type}` as LivePageModalType;
      if (prev.type === popupType) {
        return { type: null, mode: undefined, data: null };
      }
      return { type: popupType, mode: undefined, data };
    });
  }, []);

  // Open create sheet (closes tabs and popups, but not top-level modals or camera)
  const openCreate = useCallback((data?: any) => {
    setModal(prev => {
      // Don't close top-level modals or camera
      if (prev.type === 'account' || prev.type === 'mapStyles' || prev.type === 'dynamicSearch' || prev.type === 'camera') {
        return prev;
      }
      if (prev.type === 'create') {
        return { type: null, mode: undefined, data: null };
      }
      return { type: 'create', mode: undefined, data };
    });
  }, []);

  // Open bottom button popup (closes other bottom buttons and lower priority modals)
  const openBottomButton = useCallback((type: 'settings' | 'analytics' | 'collections' | 'create') => {
    setModal(prev => {
      // Don't close top-level modals, camera, or entity popups
      if (
        prev.type === 'account' || 
        prev.type === 'mapStyles' || 
        prev.type === 'dynamicSearch' || 
        prev.type === 'camera' ||
        prev.type?.startsWith('popup-')
      ) {
        return prev;
      }
      const bottomButtonType = `bottomButton-${type}` as LivePageModalType;
      if (prev.type === bottomButtonType) {
        return { type: null, mode: undefined, data: null };
      }
      return { type: bottomButtonType, mode: undefined, data: null };
    });
  }, []);

  // Close bottom button popup
  const closeBottomButton = useCallback(() => {
    setModal(prev => {
      if (prev.type?.startsWith('bottomButton-')) {
        return { type: null, mode: undefined, data: null };
      }
      return prev;
    });
  }, []);

  // Open mobile nav tab (closes other tabs, popups, create, but not top-level modals or camera)
  const openTab = useCallback((tab: MobileNavTab) => {
    setModal(prev => {
      // Don't close top-level modals or camera
      if (prev.type === 'account' || prev.type === 'mapStyles' || prev.type === 'dynamicSearch' || prev.type === 'camera') {
        return prev;
      }
      if (prev.type === tab) {
        return { type: null, mode: undefined, data: null };
      }
      return { type: tab, mode: undefined, data: null };
    });
  }, []);

  // Close specific modal types
  const closeAccount = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'account') {
        return { type: null, mode: undefined, data: null };
      }
      return prev;
    });
  }, []);

  const closeMapStyles = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'mapStyles') {
        return { type: null, mode: undefined, data: null };
      }
      return prev;
    });
  }, []);

  const closeDynamicSearch = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'dynamicSearch') {
        return { type: null, mode: undefined, data: null };
      }
      return prev;
    });
  }, []);

  const closePopup = useCallback(() => {
    setModal(prev => {
      if (prev.type?.startsWith('popup-')) {
        return { type: null, mode: undefined, data: null };
      }
      return prev;
    });
  }, []);

  const closeCreate = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'create') {
        return { type: null, mode: undefined, data: null };
      }
      return prev;
    });
  }, []);

  const closeTab = useCallback(() => {
    setModal(prev => {
      if (prev.type === 'contribute' || prev.type === 'tools') {
        return { type: null, mode: undefined, data: null };
      }
      return prev;
    });
  }, []);

  // Close all modals
  const closeAll = useCallback(() => {
    setModal({ type: null, mode: undefined, data: null });
  }, []);

  // Helper: Check if specific modal is open
  const isModalOpen = useCallback((type: LivePageModalType) => {
    return modal.type === type;
  }, [modal.type]);

  // Helper: Check if any modal is open
  const isAnyModalOpen = modal.type !== null;

  // Helper: Get current active tab (if a tab is open)
  const activeTab: MobileNavTab | null = 
    modal.type === 'contribute' || modal.type === 'tools'
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

  // Helper: Check if bottom button is open
  const isBottomButtonOpen = useCallback((type: string) => {
    return modal.type === `bottomButton-${type}`;
  }, [modal.type]);

  // Helper: Get current bottom button type
  const getBottomButtonType = useCallback((): string | null => {
    if (modal.type?.startsWith('bottomButton-')) {
      return modal.type.replace('bottomButton-', '');
    }
    return null;
  }, [modal.type]);

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
    openCamera,
    openLocationPermission,
    openLayerRecord,
    openPopup,
    openCreate,
    openBottomButton,
    openTab,
    // Close functions
    closeAccount,
    closeMapStyles,
    closeDynamicSearch,
    closeCamera,
    closeLocationPermission,
    closeLayerRecord,
    closePopup,
    closeCreate,
    closeBottomButton,
    closeTab,
    closeAll,
    // Check functions
    isModalOpen,
    isBottomButtonOpen,
    getBottomButtonType,
  };
}

