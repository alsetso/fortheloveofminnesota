'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuthStateSafe } from '@/features/auth';

export type AccountFeatureEntitlement = {
  slug: string;
  name: string;
  limit_value: number | null;
  limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  is_unlimited: boolean;
};

type BillingEntitlementsContextValue = {
  isLoading: boolean;
  error: string | null;
  accountId: string | null;
  features: AccountFeatureEntitlement[];
  featuresBySlug: Record<string, AccountFeatureEntitlement>;
  hasFeature: (slug: string) => boolean;
  getFeature: (slug: string) => AccountFeatureEntitlement | null;
  refresh: () => Promise<void>;
};

const BillingEntitlementsContext = createContext<BillingEntitlementsContextValue | undefined>(
  undefined
);

function normalizeLimitType(
  value: unknown
): AccountFeatureEntitlement['limit_type'] {
  if (value === 'count' || value === 'storage_mb' || value === 'boolean' || value === 'unlimited') {
    return value;
  }
  return null;
}

function normalizeEntitlements(payload: unknown): AccountFeatureEntitlement[] {
  const raw = (payload as any)?.features;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((row: any): AccountFeatureEntitlement | null => {
      if (!row || typeof row.slug !== 'string' || typeof row.name !== 'string') return null;
      return {
        slug: row.slug,
        name: row.name,
        limit_value: typeof row.limit_value === 'number' ? row.limit_value : null,
        limit_type: normalizeLimitType(row.limit_type),
        is_unlimited: Boolean(row.is_unlimited),
      };
    })
    .filter(Boolean) as AccountFeatureEntitlement[];
}

export function BillingEntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { user, account } = useAuthStateSafe();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [features, setFeatures] = useState<AccountFeatureEntitlement[]>([]);

  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    const nextSeq = ++requestSeq.current;

    if (!user || !account) {
      setAccountId(null);
      setFeatures([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/billing/user-features', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));

      if (nextSeq !== requestSeq.current) return;

      if (!res.ok) {
        setAccountId(account.id);
        setFeatures([]);
        setError(typeof (data as any)?.error === 'string' ? (data as any).error : 'Failed to load billing entitlements');
        return;
      }

      const normalized = normalizeEntitlements(data);
      setAccountId(typeof (data as any)?.accountId === 'string' ? (data as any).accountId : account.id);
      setFeatures(normalized);
    } catch (e) {
      if (nextSeq !== requestSeq.current) return;
      setAccountId(account.id);
      setFeatures([]);
      setError(e instanceof Error ? e.message : 'Failed to load billing entitlements');
    } finally {
      if (nextSeq !== requestSeq.current) return;
      setIsLoading(false);
    }
  }, [user, account]);

  // Refresh when the active account changes.
  useEffect(() => {
    void refresh();
  }, [refresh, account?.id, user?.id]);

  // Defensive: also refresh on the global account switch event.
  useEffect(() => {
    const onAccountChanged = () => {
      void refresh();
    };
    window.addEventListener('account-changed', onAccountChanged);
    return () => window.removeEventListener('account-changed', onAccountChanged);
  }, [refresh]);

  const featuresBySlug = useMemo(() => {
    const map: Record<string, AccountFeatureEntitlement> = {};
    for (const f of features) {
      map[f.slug] = f;
    }
    return map;
  }, [features]);

  const hasFeature = useCallback(
    (slug: string) => {
      return Boolean(featuresBySlug[slug]);
    },
    [featuresBySlug]
  );

  const getFeature = useCallback(
    (slug: string) => {
      return featuresBySlug[slug] || null;
    },
    [featuresBySlug]
  );

  const value: BillingEntitlementsContextValue = useMemo(
    () => ({
      isLoading,
      error,
      accountId,
      features,
      featuresBySlug,
      hasFeature,
      getFeature,
      refresh,
    }),
    [isLoading, error, accountId, features, featuresBySlug, hasFeature, getFeature, refresh]
  );

  return (
    <BillingEntitlementsContext.Provider value={value}>
      {children}
    </BillingEntitlementsContext.Provider>
  );
}

export function useBillingEntitlementsSafe(): BillingEntitlementsContextValue {
  const ctx = useContext(BillingEntitlementsContext);
  if (!ctx) {
    throw new Error('useBillingEntitlementsSafe must be used within BillingEntitlementsProvider');
  }
  return ctx;
}

