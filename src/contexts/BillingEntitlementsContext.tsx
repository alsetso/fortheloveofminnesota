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

// Context for initial billing data from server
const InitialBillingDataContext = createContext<{
  accountId: string | null;
  features: AccountFeatureEntitlement[];
} | null>(null);

export function InitialBillingDataProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData: {
    accountId: string | null;
    features: AccountFeatureEntitlement[];
  } | null;
}) {
  return (
    <InitialBillingDataContext.Provider value={initialData}>
      {children}
    </InitialBillingDataContext.Provider>
  );
}

function useInitialBillingData() {
  return useContext(InitialBillingDataContext);
}

export type AccountFeatureEntitlement = {
  slug: string;
  name: string;
  limit_value: number | null;
  limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  is_unlimited: boolean;
  category?: string | null;
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
        category: typeof row.category === 'string' ? row.category : null,
      };
    })
    .filter(Boolean) as AccountFeatureEntitlement[];
}

export function BillingEntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { user, account, activeAccountId } = useAuthStateSafe();
  const initialData = useInitialBillingData();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(initialData?.accountId || null);
  const [features, setFeatures] = useState<AccountFeatureEntitlement[]>(initialData?.features || []);
  
  // Cache features per account
  const featuresCache = useRef<Map<string, { features: AccountFeatureEntitlement[]; timestamp: number }>>(new Map());
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  const requestSeq = useRef(0);

  // Initialize from server data if available
  useEffect(() => {
    if (initialData) {
      setAccountId(initialData.accountId);
      setFeatures(initialData.features);
      // Cache the initial data
      if (initialData.accountId) {
        featuresCache.current.set(initialData.accountId, {
          features: initialData.features,
          timestamp: Date.now(),
        });
      }
    }
  }, [initialData]);

  const refresh = useCallback(async () => {
    const nextSeq = ++requestSeq.current;

    // Use activeAccountId if available, fallback to account.id
    const targetAccountId = activeAccountId || account?.id;
    
    if (!user) {
      setAccountId(null);
      setFeatures([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    // Auth not yet hydrated (account/activeAccountId still null) — keep server initialData if present
    if (!targetAccountId) {
      if (initialData?.accountId && initialData?.features?.length) {
        setAccountId(initialData.accountId);
        setFeatures(initialData.features);
        featuresCache.current.set(initialData.accountId, {
          features: initialData.features,
          timestamp: Date.now(),
        });
      } else {
        setAccountId(null);
        setFeatures([]);
      }
      setError(null);
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cached = featuresCache.current.get(targetAccountId);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      setAccountId(targetAccountId);
      setFeatures(cached.features);
      setError(null);
      setIsLoading(false);
      return;
    }

    // If initial data matches current account, use it (no need to refetch immediately)
    if (initialData && initialData.accountId === targetAccountId && initialData.features.length > 0) {
      setAccountId(targetAccountId);
      setFeatures(initialData.features);
      setError(null);
      setIsLoading(false);
      // Cache the initial data
      featuresCache.current.set(targetAccountId, {
        features: initialData.features,
        timestamp: now,
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/billing/user-features', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));

      if (nextSeq !== requestSeq.current) return;

      if (!res.ok) {
        setAccountId(targetAccountId);
        setFeatures([]);
        setError(typeof (data as any)?.error === 'string' ? (data as any).error : 'Failed to load billing entitlements');
        return;
      }

      const normalized = normalizeEntitlements(data);
      const returnedAccountId = typeof (data as any)?.accountId === 'string' ? (data as any).accountId : targetAccountId;
      
      // Update cache
      featuresCache.current.set(returnedAccountId, {
        features: normalized,
        timestamp: now,
      });
      
      setAccountId(returnedAccountId);
      setFeatures(normalized);
    } catch (e) {
      if (nextSeq !== requestSeq.current) return;
      setAccountId(targetAccountId);
      setFeatures([]);
      setError(e instanceof Error ? e.message : 'Failed to load billing entitlements');
    } finally {
      if (nextSeq !== requestSeq.current) return;
      setIsLoading(false);
    }
  }, [user, account, activeAccountId, initialData]);

  // Refresh when the active account changes
  useEffect(() => {
    void refresh();
  }, [refresh, activeAccountId, account?.id, user?.id]);
  
  // Clear cache when account changes
  useEffect(() => {
    if (activeAccountId) {
      // Keep cache for current account, could clear others if needed
    }
  }, [activeAccountId]);

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

