'use client';

import { useState } from 'react';
import { Account } from '@/features/auth';
import Sidebar from '@/components/sidebar/Sidebar';
import TestMap from '@/components/test/TestMap';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface TestClientProps {
  account: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    user_id: string;
  } | null;
}

export default function TestClient({ account }: TestClientProps) {
  const [mapInstance, setMapInstance] = useState<MapboxMapInstance | null>(null);
  // Convert to Account type with defaults for required fields
  const accountForSidebar: Account | null = account ? {
    id: account.id,
    user_id: account.user_id,
    username: account.username,
    first_name: account.first_name,
    last_name: account.last_name,
    image_url: account.image_url,
    email: null,
    phone: null,
    cover_image_url: null,
    bio: null,
    city_id: null,
    view_count: 0,
    role: 'general',
    traits: null,
    stripe_customer_id: null,
    plan: 'hobby',
    billing_mode: 'standard',
    subscription_status: null,
    stripe_subscription_id: null,
    onboarded: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_visit: null,
  } : null;

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden">
      <Sidebar account={accountForSidebar} map={mapInstance} />
      <div className="flex-1 relative mt-14 lg:mt-0">
        <TestMap onMapReady={(map) => { setMapInstance(map); }} />
      </div>
    </div>
  );
}

