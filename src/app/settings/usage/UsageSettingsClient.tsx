'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface Feature {
  slug: string;
  name: string;
  limit_value: number | null;
  limit_type: string | null;
  is_unlimited: boolean;
  category: string | null;
  has_feature?: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  hobby: 'Public',
  contributor: 'Contributor',
};

export default function UsageSettingsClient() {
  const { account } = useSettings();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/billing/user-features', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch features');
        }

        const data = await response.json();
        setFeatures(data.features || []);
      } catch (err) {
        console.error('Error fetching features:', err);
        setError(err instanceof Error ? err.message : 'Failed to load features');
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, []);

  const formatLimit = (feature: Feature): string => {
    // If feature is in the list, user has access to it
    // If limit_value is null and is_unlimited is false, might not have the feature
    // But since it's returned from the API, assume they have it
    
    if (feature.is_unlimited) {
      return 'Unlimited';
    }

    if (feature.limit_type === 'count' && feature.limit_value !== null) {
      return `${feature.limit_value}`;
    }

    if (feature.limit_type === 'storage_mb' && feature.limit_value !== null) {
      const gb = feature.limit_value / 1024;
      return gb >= 1 ? `${gb.toFixed(1)} GB` : `${feature.limit_value} MB`;
    }

    if (feature.limit_type === 'boolean') {
      return 'Available';
    }

    if (feature.limit_type === 'unlimited') {
      return 'Unlimited';
    }

    return 'N/A';
  };

  const hasFeature = (feature: Feature): boolean => {
    // If feature is returned from API, user has access
    // Check if it's truly unavailable by checking if limit_value is null and not unlimited
    return feature.is_unlimited || feature.limit_value !== null || feature.limit_type === 'boolean' || feature.limit_type === 'unlimited';
  };

  const getCategoryLabel = (category: string | null): string => {
    if (!category) return 'Other';
    return category
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const groupedFeatures = features.reduce((acc, feature) => {
    const category = getCategoryLabel(feature.category);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(feature);
    return acc;
  }, {} as Record<string, Feature[]>);

  const planLabel = account?.plan ? PLAN_LABELS[account.plan] || account.plan : 'Public';

  return (
    <div className="space-y-3">
      {/* Current Plan */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-foreground mb-2">Current Plan</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-foreground">{planLabel}</p>
            {account?.plan && account.plan !== 'hobby' && (
              <Link
                href="/pricing"
                className="text-xs text-lake-blue hover:text-lake-blue/80 hover:underline mt-0.5 inline-block"
              >
                Upgrade or change plan
              </Link>
            )}
          </div>
          {account?.plan === 'hobby' && (
            <Link
              href="/pricing"
              className="px-3 py-1.5 text-xs font-medium text-foreground bg-lake-blue hover:bg-lake-blue/80 rounded-md transition-colors"
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>

      {/* Features by Category */}
      {loading ? (
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <p className="text-xs text-foreground/60">Loading features...</p>
        </div>
      ) : error ? (
        <div className="bg-surface border border-red-500/50 rounded-md p-[10px]">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      ) : features.length === 0 ? (
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <p className="text-xs text-foreground/60">No features found.</p>
        </div>
      ) : (
        Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
          <div key={category} className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
            <div className="px-[10px] py-2 border-b border-border-muted dark:border-white/10 bg-surface-accent">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                {category}
              </h3>
            </div>
            <div className="divide-y divide-border-muted dark:divide-white/10">
              {categoryFeatures.map((feature) => {
                const hasAccess = hasFeature(feature);
                return (
                  <div
                    key={feature.slug}
                    className="px-[10px] py-3 flex items-center justify-between hover:bg-surface-accent transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {hasAccess ? (
                        <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                      ) : (
                        <XCircleIcon className="w-4 h-4 text-foreground-subtle flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium text-foreground truncate">
                        {feature.name}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-medium flex-shrink-0 ml-2 ${
                        hasAccess
                          ? feature.is_unlimited
                            ? 'text-green-400'
                            : 'text-foreground-muted'
                          : 'text-foreground/50'
                      }`}
                    >
                      {formatLimit(feature)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Upgrade CTA for Hobby plan */}
      {account?.plan === 'hobby' && (
        <div className="bg-lake-blue/10 border border-lake-blue/30 rounded-md p-[10px]">
          <h3 className="text-sm font-semibold text-lake-blue mb-1">Upgrade for More Features</h3>
          <p className="text-xs text-foreground/80 mb-2">
            Unlock unlimited maps, advanced analytics, and more with a paid plan.
          </p>
          <Link
            href="/pricing"
            className="inline-block px-3 py-1.5 text-xs font-medium text-foreground bg-lake-blue hover:bg-lake-blue/80 rounded-md transition-colors"
          >
            View Plans
          </Link>
        </div>
      )}
    </div>
  );
}
