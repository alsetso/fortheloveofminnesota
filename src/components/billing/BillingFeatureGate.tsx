'use client';

import React from 'react';
import Link from 'next/link';
import { useBillingEntitlementsSafe } from '@/contexts/BillingEntitlementsContext';

type BillingFeatureGateProps = {
  featureSlug: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  mode?: 'hide' | 'disable';
  upgradeHref?: string;
};

export default function BillingFeatureGate({
  featureSlug,
  children,
  fallback = null,
  mode = 'hide',
  upgradeHref = '/pricing',
}: BillingFeatureGateProps) {
  const { isLoading, hasFeature } = useBillingEntitlementsSafe();

  // Avoid flash-of-locked-content by defaulting to hidden until entitlements load.
  if (isLoading) {
    return null;
  }

  const allowed = hasFeature(featureSlug);
  if (allowed) {
    return <>{children}</>;
  }

  if (mode === 'disable') {
    return (
      <div className="space-y-2">
        <div className="opacity-60 pointer-events-none select-none">{children}</div>
        <div className="text-xs text-gray-600">
          Locked.{' '}
          <Link href={upgradeHref} className="text-blue-600 hover:text-blue-800 underline">
            Upgrade
          </Link>
        </div>
      </div>
    );
  }

  return <>{fallback}</>;
}

