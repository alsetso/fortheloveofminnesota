'use client';

import { useEffect } from 'react';
import { useAuthSafe } from '@/features/auth';
import {
  clearSavedAddressPins,
  refreshSavedAddressPins,
} from '@/features/map/savedAddresses/savedAddressesStore';
import { useMapContext } from '@/map/MapProvider';

/** Loads saved address pins once signed in and the map is ready. */
export function SavedAddressesProvider({ children }: { children: React.ReactNode }) {
  const { account } = useAuthSafe();
  const { ready } = useMapContext();

  useEffect(() => {
    if (!account?.id) {
      clearSavedAddressPins();
      return;
    }
    // Wait for map ready so the layer can subscribe before / with first data push.
    if (!ready) return;
    const ac = new AbortController();
    void refreshSavedAddressPins(ac.signal);
    return () => ac.abort();
  }, [account?.id, ready]);

  return children;
}
