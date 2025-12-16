'use client';

import MapDetailClient from './MapDetailClient';
import type { UserMap } from '@/features/user-maps/types';
import type { Account } from '@/features/auth';

interface MapDetailWrapperProps {
  mapId: string;
  initialMap: UserMap;
  account: Account | null;
}

/**
 * Wrapper component that provides MapHandlersContext
 * This component renders MapDetailClient which provides the context
 * The toolbar will be rendered inside this wrapper via children
 */
export default function MapDetailWrapper({ 
  mapId, 
  initialMap, 
  account
}: MapDetailWrapperProps) {
  return (
    <MapDetailClient mapId={mapId} initialMap={initialMap} account={account} />
  );
}

