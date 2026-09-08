'use client';

import { useEffect } from 'react';
import { listAccountInterestIds, listVisibleInterests } from '@/lib/accountInterests/api';
import { resetInterestsForAccount } from '@/lib/accountInterests/store';
import { listAccountPlaces } from '@/lib/accountPlaces/api';
import { clearAccountPlaces } from '@/lib/accountPlaces/store';

/** Warm Places + Interests stores for Discover summary and subpages. */
export function useWarmPlacesInterests(accountId: string | null) {
  useEffect(() => {
    if (!accountId) {
      clearAccountPlaces();
      resetInterestsForAccount(null);
      return;
    }
    resetInterestsForAccount(accountId);
    void Promise.all([
      listAccountPlaces(accountId),
      listVisibleInterests().then(() => listAccountInterestIds(accountId)),
    ]).catch(() => {
      /* pages retry on next open */
    });
  }, [accountId]);
}
