'use client';

import { useEffect } from 'react';
import { listAccountSchools } from '@/lib/accountSchools/api';
import { clearAccountSchools } from '@/lib/accountSchools/store';

/** Warm account schools store for Discover summary and /discover/schools. */
export function useWarmAccountSchools(accountId: string | null) {
  useEffect(() => {
    if (!accountId) {
      clearAccountSchools();
      return;
    }
    void listAccountSchools(accountId).catch(() => {
      /* page retries on next open */
    });
  }, [accountId]);
}
