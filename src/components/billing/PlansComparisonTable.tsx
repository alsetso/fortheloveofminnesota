'use client';

import { useState, useEffect } from 'react';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';

interface PlanFeatureAdmin {
  feature_id: string;
  feature_slug: string;
  feature_name: string;
  limit_value: number | null;
  limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
}

interface PlanFeaturePublic extends BillingFeature {
  isInherited: boolean;
  limit_value?: number | null;
  limit_type?: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
}

interface PlanWithFeatures extends BillingPlan {
  features: PlanFeatureAdmin[] | PlanFeaturePublic[];
}

interface PlansComparisonTableProps {
  currentPlanSlug?: string | null;
  isAdmin?: boolean;
}

export default function PlansComparisonTable({ currentPlanSlug, isAdmin = false }: PlansComparisonTableProps) {
  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [allFeatures, setAllFeatures] = useState<BillingFeature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, [isAdmin]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const endpoint = isAdmin ? '/api/admin/billing/plans' : '/api/billing/plans';
      const response = await fetch(endpoint);
      
      if (response.ok) {
        const data = await response.json();
        
        if (isAdmin) {
          // Admin API returns plans with features directly
          setPlans(data.plans || []);
          
          // Fetch all features separately for admin view (including inactive)
          // Note: Admin features API filters by is_active, but we need all features
          // that might be referenced in plans. We'll handle missing features gracefully.
          const featuresRes = await fetch('/api/admin/billing/features');
          if (featuresRes.ok) {
            const featuresData = await featuresRes.json();
            // Admin API returns { features: grouped, all: features }
            // Note: This only returns active features, but plan-features might reference inactive ones
            setAllFeatures((featuresData.all || []) as BillingFeature[]);
          }
        } else {
          // Public API returns plans with features and allFeatures
          setPlans(data.plans || []);
          setAllFeatures(data.allFeatures || []);
        }
      } else {
        console.error('Failed to fetch plans');
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
          <p className="mt-3 text-xs text-gray-500">Loading plans...</p>
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="w-full py-12">
        <div className="text-center">
          <p className="text-xs text-gray-500">No plans available</p>
        </div>
      </div>
    );
  }

  // Build a map of all features across all plans
  const allFeaturesMap = new Map<string, BillingFeature & { plans: Set<string> }>();
  
  plans.forEach((plan) => {
    plan.features.forEach((pf) => {
      // Handle both admin and public API formats
      const featureId = isAdmin 
        ? (pf as PlanFeatureAdmin).feature_id 
        : (pf as PlanFeaturePublic).id;
      
      if (!allFeaturesMap.has(featureId)) {
        // Find the full feature details
        let fullFeature: BillingFeature | undefined;
        
        if (isAdmin) {
          // Admin format: find by feature_id from allFeatures
          fullFeature = allFeatures.find((f) => f.id === (pf as PlanFeatureAdmin).feature_id);
          
          // If not found in allFeatures, create a minimal feature from plan data
          // This handles cases where a plan references an inactive feature
          if (!fullFeature) {
            const adminPf = pf as PlanFeatureAdmin;
            fullFeature = {
              id: adminPf.feature_id,
              slug: adminPf.feature_slug,
              name: adminPf.feature_name,
              description: null,
              category: null,
              emoji: null,
              is_active: false, // Assume inactive if not in allFeatures (admin API filters by is_active)
              created_at: '',
              updated_at: '',
            };
          }
        } else {
          // Public format: feature is already a BillingFeature
          fullFeature = pf as BillingFeature;
        }
        
        if (fullFeature) {
          allFeaturesMap.set(featureId, {
            ...fullFeature,
            plans: new Set(),
          });
        }
      }
      allFeaturesMap.get(featureId)?.plans.add(plan.id);
    });
  });

  const sortedFeatures = Array.from(allFeaturesMap.values()).sort((a, b) => {
    // Sort by category, then name
    if (a.category !== b.category) {
      return (a.category || '').localeCompare(b.category || '');
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="w-full">
      <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left p-[10px] text-xs font-semibold text-gray-900 sticky left-0 bg-white z-10">
                Feature
              </th>
              {plans.map((plan) => {
                const priceDisplay = plan.price_monthly_cents === 0 
                  ? 'Free' 
                  : `$${(plan.price_monthly_cents / 100).toFixed(0)}/mo`;
                const isUserActivePlan = currentPlanSlug && plan.slug.toLowerCase() === currentPlanSlug.toLowerCase();
                
                return (
                  <th
                    key={plan.id}
                    className={`text-center p-[10px] text-xs font-semibold text-gray-900 min-w-[120px] ${
                      isUserActivePlan ? 'bg-green-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="font-bold text-gray-900">{plan.name}</div>
                    <div className="text-[10px] text-gray-600 mt-0.5">{priceDisplay}</div>
                    {isUserActivePlan && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500 text-white">
                          Active
                        </span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedFeatures.map((feature) => (
              <tr key={feature.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="p-[10px] text-xs text-gray-700 sticky left-0 bg-white z-10">
                  <div className="flex items-center gap-1.5">
                    {feature.emoji && <span className="text-sm">{feature.emoji}</span>}
                    <span className="font-medium">{feature.name}</span>
                    {feature.category && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 capitalize">
                        {feature.category}
                      </span>
                    )}
                    {!feature.is_active && (
                      <span className="text-[10px] text-gray-400 italic">(Soon)</span>
                    )}
                  </div>
                </td>
                {plans.map((plan) => {
                  // Find feature in plan - handle both formats
                  let planFeature: PlanFeatureAdmin | PlanFeaturePublic | undefined;
                  
                  if (isAdmin) {
                    planFeature = (plan.features as PlanFeatureAdmin[]).find(
                      (f) => f.feature_id === feature.id
                    );
                  } else {
                    planFeature = (plan.features as PlanFeaturePublic[]).find(
                      (f) => f.id === feature.id
                    );
                  }
                  
                  const hasFeature = !!planFeature;
                  const isUserActivePlan = currentPlanSlug && plan.slug.toLowerCase() === currentPlanSlug.toLowerCase();
                  
                  // Get limit info from planFeature
                  const limitType = planFeature?.limit_type || null;
                  const limitValue = planFeature?.limit_value ?? null;
                  
                  return (
                    <td
                      key={plan.id}
                      className={`text-center p-[10px] text-xs ${
                        isUserActivePlan ? 'bg-green-50' : ''
                      }`}
                    >
                      {hasFeature ? (
                        <div className="flex flex-col items-center gap-0.5">
                          {limitType === 'boolean' || !limitType ? (
                            <span className="text-green-500 font-semibold">✓</span>
                          ) : limitType === 'unlimited' ? (
                            <span className="text-gray-900 font-semibold">∞</span>
                          ) : limitType === 'count' && limitValue !== null ? (
                            <span className="text-gray-900 font-semibold">{limitValue}</span>
                          ) : limitType === 'storage_mb' && limitValue !== null ? (
                            <span className="text-gray-900 font-semibold text-[10px]">
                              {limitValue >= 1000 
                                ? `${(limitValue / 1000).toFixed(1)}GB`
                                : `${limitValue}MB`}
                            </span>
                          ) : (
                            <span className="text-green-500 font-semibold">✓</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
