'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, AccountService, Account } from '@/features/auth';
import { isAccountComplete as checkAccountComplete } from '@/lib/accountCompleteness';
import { GuestAccountService } from '@/features/auth/services/guestAccountService';
import { cleanAuthParams, getGuestIdFromUrl } from '@/lib/urlParams';

export type HomepageModalState = 
  | 'none'
  | 'welcome'
  | 'account'
  | 'create-pin';

export interface HomepageState {
  // Modal states
  modalState: HomepageModalState;
  accountModalTab: string | null;
  
  // Sidebar state
  isSidebarOpen: boolean;
  
  // Pin creation state
  createPinCoordinates: { lat: number; lng: number } | null;
  
  // Account state
  account: Account | null;
  isAccountComplete: boolean;
  isCheckingAccount: boolean;
}

interface UseHomepageStateOptions {
  onStateChange?: (state: HomepageState) => void;
}

export function useHomepageState(options?: UseHomepageStateOptions) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<HomepageState>({
    modalState: 'none',
    accountModalTab: null,
    isSidebarOpen: true,
    createPinCoordinates: null,
    account: null,
    isAccountComplete: true,
    isCheckingAccount: false,
  });

  const previousUserRef = useRef(user);
  const isInitialMountRef = useRef(true);

  // Update state helper
  const updateState = useCallback((updates: Partial<HomepageState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      options?.onStateChange?.(newState);
      return newState;
    });
  }, [options]);

  // Close all modals helper
  const closeAllModals = useCallback(() => {
    updateState({
      modalState: 'none',
      accountModalTab: null,
      createPinCoordinates: null,
    });
  }, [updateState]);

  // Open welcome modal
  const openWelcomeModal = useCallback(() => {
    updateState({
      modalState: 'welcome',
      isSidebarOpen: false,
    });
  }, [updateState]);

  // Close welcome modal
  const closeWelcomeModal = useCallback(() => {
    if (state.modalState === 'welcome') {
      updateState({
        modalState: 'none',
        isSidebarOpen: true,
      });
    }
  }, [state.modalState, updateState]);

  // Open account modal
  const openAccountModal = useCallback((tab?: string) => {
    updateState({
      modalState: 'account',
      accountModalTab: tab || null,
      isSidebarOpen: false,
    });
  }, [updateState]);

  // Close account modal
  const closeAccountModal = useCallback(() => {
    if (state.modalState === 'account') {
      // Prevent closing if account is incomplete
      if (!state.isAccountComplete) {
        return;
      }
      updateState({
        modalState: 'none',
        accountModalTab: null,
        isSidebarOpen: true,
      });
    }
  }, [state.modalState, state.isAccountComplete, updateState]);

  // Open create pin modal
  const openCreatePinModal = useCallback((coordinates: { lat: number; lng: number }) => {
    updateState({
      modalState: 'create-pin',
      createPinCoordinates: coordinates,
      isSidebarOpen: false,
    });
  }, [updateState]);

  // Close create pin modal
  const closeCreatePinModal = useCallback(() => {
    if (state.modalState === 'create-pin') {
      updateState({
        modalState: 'none',
        createPinCoordinates: null,
        isSidebarOpen: true,
      });
    }
  }, [state.modalState, updateState]);

  // Go back from create pin modal to location sidebar
  const backFromCreatePin = useCallback(() => {
    if (state.modalState === 'create-pin') {
      updateState({
        modalState: 'none',
        isSidebarOpen: true,
        // Keep createPinCoordinates so temporary pin remains
      });
    }
  }, [state.modalState, updateState]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    // Only allow toggling if no modal is open
    if (state.modalState === 'none') {
      updateState({
        isSidebarOpen: !state.isSidebarOpen,
      });
    }
  }, [state.modalState, state.isSidebarOpen, updateState]);

  // Set sidebar open/closed
  const setSidebarOpen = useCallback((open: boolean) => {
    // Only allow setting if no modal is open
    // Exception: allow closing sidebar even when modal is open (for cleanup)
    if (state.modalState === 'none' || !open) {
      updateState({
        isSidebarOpen: open,
      });
    }
  }, [state.modalState, updateState]);
  
  // Open sidebar for map click (only if no modal is open)
  const openSidebarForMapClick = useCallback(() => {
    if (state.modalState === 'none') {
      updateState({
        isSidebarOpen: true,
      });
    }
  }, [state.modalState, updateState]);

  // Check account completeness
  const checkAccountCompleteness = useCallback(async () => {
    if (!user) {
      updateState({
        account: null,
        isAccountComplete: true,
        isCheckingAccount: false,
      });
      return;
    }

    updateState({ isCheckingAccount: true });

    try {
      const accountData = await AccountService.getCurrentAccount();
      const complete = checkAccountComplete(accountData);
      
      updateState({
        account: accountData,
        isAccountComplete: complete,
        isCheckingAccount: false,
      });

      return { account: accountData, isComplete: complete };
    } catch (error) {
      console.error('Error checking account completeness:', error);
      updateState({
        account: null,
        isAccountComplete: false,
        isCheckingAccount: false,
      });
      return { account: null, isComplete: false };
    }
  }, [user, updateState]);

  // Refresh account data
  const refreshAccount = useCallback(async () => {
    const result = await checkAccountCompleteness();
    
    // If account is now complete and we're on onboarding tab, allow closing
    if (result.isComplete && state.modalState === 'account' && state.accountModalTab === 'onboarding') {
      // Account is complete, user can now close modal
    }
    
    return result;
  }, [checkAccountCompleteness, state.modalState, state.accountModalTab]);

  // Handle user authentication state changes
  useEffect(() => {
    const userChanged = previousUserRef.current !== user;
    previousUserRef.current = user;

    // Initial mount: initialize guest mode if not authenticated
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (!user) {
        // Check if guest_id is in URL and sync with localStorage
        const urlGuestId = getGuestIdFromUrl(searchParams);
        if (urlGuestId && typeof window !== 'undefined') {
          // Sync URL guest_id with localStorage
          localStorage.setItem('mnuda_guest_id', urlGuestId);
        }
        
        // Force guest mode: ensure guest ID exists
        try {
          GuestAccountService.getGuestId();
          // If no guest name, set default
          if (!GuestAccountService.getGuestName()) {
            GuestAccountService.setGuestName('Guest');
          }
        } catch (error) {
          console.error('[useHomepageState] Error initializing guest:', error);
        }
        openWelcomeModal();
        return;
      }
    }

    // User logged out: reinitialize guest mode
    if (userChanged && !user) {
      closeAllModals();
      // Reinitialize guest mode
      try {
        GuestAccountService.getGuestId();
        if (!GuestAccountService.getGuestName()) {
          GuestAccountService.setGuestName('Guest');
        }
      } catch (error) {
        console.error('[useHomepageState] Error reinitializing guest:', error);
      }
      openWelcomeModal();
      return;
    }

    // User logged in: check account and show onboarding if needed
    if (userChanged && user) {
      // Clean guest/account parameters from URL when user logs in
      cleanAuthParams(router);
      
      checkAccountCompleteness().then((result) => {
        if (result && !result.isComplete) {
          // Account incomplete: open account modal with onboarding tab
          openAccountModal('onboarding');
        } else {
          // Account complete: close any modals
          if (state.modalState === 'welcome') {
            closeWelcomeModal();
          }
        }
      });
    }
  }, [user, openWelcomeModal, closeAllModals, openAccountModal, closeWelcomeModal, checkAccountCompleteness, state.modalState]);

  // Check account completeness when user is authenticated
  useEffect(() => {
    if (user && !state.account) {
      checkAccountCompleteness();
    }
  }, [user, state.account, checkAccountCompleteness]);

  return {
    // State
    state,
    
    // Modal controls
    openWelcomeModal,
    closeWelcomeModal,
    openAccountModal,
    closeAccountModal,
    openCreatePinModal,
    closeCreatePinModal,
    backFromCreatePin,
    closeAllModals,
    
    // Sidebar controls
    toggleSidebar,
    setSidebarOpen,
    openSidebarForMapClick,
    
    // Account controls
    checkAccountCompleteness,
    refreshAccount,
  };
}


