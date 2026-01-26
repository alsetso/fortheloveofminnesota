'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';
import { useAuthStateSafe } from '@/features/auth';
import { useBillingEntitlementsSafe } from '@/contexts/BillingEntitlementsContext';

interface PlanWithFeatures extends BillingPlan {
  features: (BillingFeature & { 
    isInherited: boolean;
    limit_value?: number | null;
    limit_type?: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  })[];
  directFeatureCount: number;
  inheritedFeatureCount: number;
}

export default function PlansPageClient() {
  const router = useRouter();
  const { account, activeAccountId } = useAuthStateSafe();
  const { features, isLoading: featuresLoading } = useBillingEntitlementsSafe();
  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCount, setMapCount] = useState<number | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  // Fetch current usage for active account
  useEffect(() => {
    if (!activeAccountId) return;
    
    const fetchUsage = async () => {
      try {
        const mapsResponse = await fetch(`/api/maps?account_id=${activeAccountId}`);
        if (mapsResponse.ok) {
          const mapsData = await mapsResponse.json();
          setMapCount(mapsData.maps?.length || 0);
        }
      } catch (err) {
        console.error('Error fetching usage:', err);
      }
    };
    
    fetchUsage();
  }, [activeAccountId]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/plans');
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
      } else {
        console.error('Failed to fetch plans');
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (planSlug: string) => {
    // If user is authenticated, redirect to billing page
    // Otherwise, redirect to sign in
    if (account) {
      router.push(`/billing#plan-${planSlug}`);
    } else {
      router.push(`/billing#plan-${planSlug}`);
    }
  };

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(0)}/mo`;
  };

  const formatFeatureLimit = (feature: BillingFeature & { 
    limit_value?: number | null;
    limit_type?: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  }) => {
    if (!feature.limit_type || feature.limit_type === 'boolean') {
      return feature.name;
    }
    
    if (feature.limit_type === 'unlimited') {
      return `Unlimited ${feature.name}`;
    }
    
    if (feature.limit_type === 'count' && feature.limit_value !== null) {
      return `${feature.limit_value} ${feature.name}`;
    }
    
    if (feature.limit_type === 'storage_mb' && feature.limit_value !== null && feature.limit_value !== undefined) {
      const gb = feature.limit_value >= 1000 ? (feature.limit_value / 1000).toFixed(1) : null;
      return gb ? `${gb}GB ${feature.name}` : `${feature.limit_value}MB ${feature.name}`;
    }
    
    return feature.name;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-[10px] py-3">
        <div className="w-full py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
            <p className="mt-3 text-xs text-gray-500">Loading plans...</p>
          </div>
        </div>
      </div>
    );
  }

  const currentPlanSlug = account?.plan?.toLowerCase();
  const mapFeature = features.find(f => f.slug === 'map' || f.slug === 'custom_maps');

  return (
    <div className="max-w-7xl mx-auto px-[10px] py-3">
      {/* Header */}
      <div className="mb-6 space-y-1.5">
        <h1 className="text-sm font-semibold text-gray-900">Pricing Plans</h1>
        <p className="text-xs text-gray-600">
          Choose the plan that fits your needs. All plans include access to our platform with varying feature limits.
        </p>
        
        {/* Current Account Usage */}
        {account && activeAccountId && !featuresLoading && (
          <div className="mt-3 p-[10px] bg-gray-50 border border-gray-200 rounded-md">
            <div className="text-xs font-medium text-gray-900 mb-1.5">Current Usage</div>
            <div className="space-y-1">
              {mapFeature && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Maps</span>
                  <span className="font-medium text-gray-900">
                    {mapCount !== null 
                      ? mapFeature.is_unlimited 
                        ? `${mapCount} (unlimited)`
                        : `${mapCount} / ${mapFeature.limit_value || 'unlimited'}`
                      : '...'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {plans.map((plan) => {
          const directFeatures = plan.features.filter(f => !f.isInherited);
          const booleanFeatures = directFeatures.filter(f => !f.limit_type || f.limit_type === 'boolean');
          const limitFeatures = directFeatures.filter(f => f.limit_type && f.limit_type !== 'boolean');
          const isUserActivePlan = currentPlanSlug && plan.slug.toLowerCase() === currentPlanSlug.toLowerCase();
          
          return (
            <div
              key={plan.id}
              className={`flex flex-col bg-white border rounded-md overflow-hidden transition-all ${
                isUserActivePlan 
                  ? 'border-2 border-green-500' 
                  : 'border border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Plan Header */}
              <div className={`p-[10px] border-b ${
                isUserActivePlan 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-sm font-semibold text-gray-900">{plan.name}</h3>
                  {isUserActivePlan && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500 text-white">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1.5">
                  {formatPrice(plan.price_monthly_cents)}
                </div>
                {plan.description && (
                  <p className="text-xs text-gray-600 leading-relaxed">{plan.description}</p>
                )}
              </div>

              {/* Features List */}
              <div className="flex-1 p-[10px] space-y-3 min-h-[300px]">
                {/* Boolean Features */}
                {booleanFeatures.length > 0 && (
                  <div className="space-y-1.5">
                    {booleanFeatures.map((feature) => (
                      <div
                        key={feature.id}
                        className="flex items-start gap-1.5 text-xs text-gray-700"
                      >
                        <CheckCircleIcon className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                        <div className="flex items-center gap-1.5 flex-1">
                          {feature.emoji && (
                            <span className="text-sm flex-shrink-0">{feature.emoji}</span>
                          )}
                          <span className="font-medium">{feature.name}</span>
                          {!feature.is_active && (
                            <span className="text-[10px] text-gray-400 italic">(Soon)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Features with Limits */}
                {limitFeatures.length > 0 && (
                  <div className="space-y-1.5 pt-1.5 border-t border-gray-200">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Limits
                    </div>
                    {limitFeatures.map((feature) => (
                      <div
                        key={feature.id}
                        className="flex items-start gap-1.5 text-xs text-gray-700"
                      >
                        <CheckCircleIcon className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                        <div className="flex items-center gap-1.5 flex-1">
                          {feature.emoji && (
                            <span className="text-sm flex-shrink-0">{feature.emoji}</span>
                          )}
                          <span className="font-semibold">{formatFeatureLimit(feature)}</span>
                          {!feature.is_active && (
                            <span className="text-[10px] text-gray-400 italic">(Soon)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {directFeatures.length === 0 && (
                  <div className="text-xs text-gray-500 text-center py-6">
                    No features listed
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <div className="p-[10px] border-t border-gray-200 bg-white">
                <button
                  onClick={() => handleSelectPlan(plan.slug)}
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                    isUserActivePlan
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {isUserActivePlan ? 'Manage Plan' : 'Select Plan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Note */}
      {plans.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            All plans include access to all features from lower tiers. Features marked with "(Soon)" are coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
