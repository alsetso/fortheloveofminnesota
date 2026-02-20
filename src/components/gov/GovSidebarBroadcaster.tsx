'use client';

import { useEffect } from 'react';
import { useGovSidebar, type GovSidebarData } from '@/contexts/GovSidebarContext';

interface GovSidebarBroadcasterProps {
  data: GovSidebarData;
}

/**
 * Thin client component used by server pages to broadcast page-specific data
 * into GovSidebarContext so GovContextSidebar can render it.
 * Renders nothing — purely a side-effect component.
 */
export default function GovSidebarBroadcaster({ data }: GovSidebarBroadcasterProps) {
  const { setData } = useGovSidebar();

  useEffect(() => {
    setData(data);
    return () => setData({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
