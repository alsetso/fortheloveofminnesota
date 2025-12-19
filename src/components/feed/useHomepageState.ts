'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, Account } from '@/features/auth';
import { isAccountComplete as checkAccountComplete } from '@/lib/accountCompleteness';
import { cleanAuthParams } from '@/lib/urlParams';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { checkOnboardingStatus } from '@/lib/onboardingCheck';

export type HomepageModalState = 
  | 'none'
  | 'welcome'
  | 'account';

export interface HomepageState {
  // Modal states
  modalState: HomepageModalState;
  accountModalTab: string | null;
  
  // Sidebar state
  isSidebarOpen: boolean;
  
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
  const { openOnboarding } = useAppModalContextSafe();
  const [state, setState] = useState<HomepageState>({
    modalState: 'none',
    accountModalTab: null,
    isSidebarOpen: true,
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

  // Check account completeness - simplified and centralized
  const checkAccountCompleteness = useCallback(async () => {
    if (!user) {
      updateState({
        account: null,
        isAccountComplete: true,
        isCheckingAccount: false,
      });
      return { account: null, isComplete: true };
    }

    updateState({ isCheckingAccount: true });

    try {
      const { needsOnboarding, account } = await checkOnboardingStatus();
      const isComplete = !needsOnboarding;
      
      updateState({
        account,
        isAccountComplete: isComplete,
        isCheckingAccount: false,
      });

      return { account, isComplete };
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
    
    // Account completeness is now handled by OnboardingModal itself
    return result;
  }, [checkAccountCompleteness]);

  // Handle user authentication state changes
  useEffect(() => {
    const userChanged = previousUserRef.current !== user;
    previousUserRef.current = user;

    // Initial mount: initialize guest mode if not authenticated
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (!user) {
        openWelcomeModal();
        return;
      }
    }

    // User logged out: reinitialize guest mode
    if (userChanged && !user) {
      closeAllModals();
      openWelcomeModal();
      return;
    }

    // User logged in: check account and show onboarding if needed
    if (userChanged && user) {
      // Clean guest/account parameters from URL when user logs in
      cleanAuthParams(router);
      
      // Check onboarding status and open modal if needed
      checkAccountCompleteness().then((result) => {
        if (result && !result.isComplete) {
          // Account incomplete: open onboarding modal immediately
          openOnboarding();
        } else if (result && result.isComplete) {
          // Account complete: close welcome modal if open
          if (state.modalState === 'welcome') {
            closeWelcomeModal();
          }
        }
      });
    }
  }, [user, openWelcomeModal, closeAllModals, openAccountModal, closeWelcomeModal, checkAccountCompleteness, openOnboarding, state.modalState, router]);

  // Check account completeness when user is authenticated and account not loaded
  // This handles cases where user was already authenticated on page load
  useEffect(() => {
    if (user && !state.account && !state.isCheckingAccount) {
      checkAccountCompleteness().then((result) => {
        // If incomplete, open onboarding
        if (result && !result.isComplete) {
          openOnboarding();
        }
      });
    }
  }, [user, state.account, state.isCheckingAccount, checkAccountCompleteness, openOnboarding]);

  return {
    // State
    state,
    
    // Modal controls
    openWelcomeModal,
    closeWelcomeModal,
    openAccountModal,
    closeAccountModal,
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



