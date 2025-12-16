'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { GuestAccountService, type GuestAccount } from '@/features/auth/services/guestAccountService';
import { AccountService } from '@/features/auth/services/memberService';

export interface GuestAccountMergeState {
  hasGuestData: boolean;
  guestAccount: GuestAccount | null;
  pinCount: number | null;
  isChecking: boolean;
  isMerging: boolean;
  mergeError: string | null;
}

export interface UseGuestAccountMergeReturn {
  state: GuestAccountMergeState;
  checkForGuestAccount: () => Promise<void>;
  mergeGuestAccount: (deleteGuestAccount?: boolean) => Promise<void>;
  dismissMerge: () => void;
}

/**
 * Hook to handle guest account merging when user signs in
 * Detects if user has guest data in local storage and offers to merge it
 */
export function useGuestAccountMerge(): UseGuestAccountMergeReturn {
  const { user } = useAuth();
  const [state, setState] = useState<GuestAccountMergeState>({
    hasGuestData: false,
    guestAccount: null,
    pinCount: null,
    isChecking: false,
    isMerging: false,
    mergeError: null,
  });

  const checkForGuestAccount = useCallback(async () => {
    // Only check if user is authenticated and has guest data
    if (!user || !GuestAccountService.hasGuestData()) {
      setState(prev => ({
        ...prev,
        hasGuestData: false,
        guestAccount: null,
        pinCount: null,
      }));
      return;
    }

    setState(prev => ({ ...prev, isChecking: true, mergeError: null }));

    try {
      const guestId = GuestAccountService.getGuestId();
      const guestAccount = await GuestAccountService.getGuestAccountByGuestId(guestId);

      if (!guestAccount) {
        // Guest account doesn't exist or was already merged/deleted
        setState(prev => ({
          ...prev,
          hasGuestData: false,
          guestAccount: null,
          pinCount: null,
          isChecking: false,
        }));
        return;
      }

      // Get pin count for the guest account
      const stats = await GuestAccountService.getGuestAccountStats(guestAccount.id);

      setState(prev => ({
        ...prev,
        hasGuestData: true,
        guestAccount,
        pinCount: stats?.pin_count || 0,
        isChecking: false,
      }));
    } catch (error) {
      console.error('[useGuestAccountMerge] Error checking for guest account:', error);
      setState(prev => ({
        ...prev,
        isChecking: false,
        mergeError: error instanceof Error ? error.message : 'Failed to check for guest account',
      }));
    }
  }, [user]);

  const mergeGuestAccount = useCallback(async (deleteGuestAccount: boolean = true) => {
    if (!state.guestAccount || !user) {
      return;
    }

    setState(prev => ({ ...prev, isMerging: true, mergeError: null }));

    try {
      // Get user's authenticated account
      const userAccount = await AccountService.getCurrentAccount();
      if (!userAccount) {
        throw new Error('User account not found');
      }

      // Merge guest account into user account
      const result = await GuestAccountService.mergeGuestAccountIntoUser(
        state.guestAccount.id,
        userAccount.id,
        deleteGuestAccount
      );

      console.log('[useGuestAccountMerge] Merged guest account:', result);

      // Clear state after successful merge
      setState({
        hasGuestData: false,
        guestAccount: null,
        pinCount: null,
        isChecking: false,
        isMerging: false,
        mergeError: null,
      });
    } catch (error) {
      console.error('[useGuestAccountMerge] Error merging guest account:', error);
      setState(prev => ({
        ...prev,
        isMerging: false,
        mergeError: error instanceof Error ? error.message : 'Failed to merge guest account',
      }));
    }
  }, [state.guestAccount, user]);

  const dismissMerge = useCallback(() => {
    // Clear guest data from local storage if user dismisses
    GuestAccountService.clearGuestData();
    setState({
      hasGuestData: false,
      guestAccount: null,
      pinCount: null,
      isChecking: false,
      isMerging: false,
      mergeError: null,
    });
  }, []);

  // Merge functionality disabled - guest accounts remain separate from user accounts
  // Guest data is not automatically checked or merged when user signs in
  // useEffect(() => {
  //   if (user) {
  //     // Small delay to ensure account is fully loaded
  //     const timeoutId = setTimeout(() => {
  //       checkForGuestAccount();
  //     }, 500);

  //     return () => clearTimeout(timeoutId);
  //   } else {
  //     // Clear state when user signs out
  //     setState({
  //       hasGuestData: false,
  //       guestAccount: null,
  //       pinCount: null,
  //       isChecking: false,
  //       isMerging: false,
  //       mergeError: null,
  //     });
  //   }
  // }, [user, checkForGuestAccount]);

  return {
    state,
    checkForGuestAccount,
    mergeGuestAccount,
    dismissMerge,
  };
}


