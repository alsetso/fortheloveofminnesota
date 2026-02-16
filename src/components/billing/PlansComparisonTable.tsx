'use client';

import { useState, useEffect } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import PlanPaymentModal from '@/components/billing/PlanPaymentModal';
import type { BillingPlan, BillingFeature, PlanWithFeatures } from '@/lib/billing/types';

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

interface PlansComparisonTableProps {
  currentPlanSlug?: string | null;
  isAdmin?: boolean;
  /** When provided, use these plans instead of fetching (e.g. from parent). */
  initialPlans?: PlanWithFeatures[] | null;
  /** When provided, View Plan row calls this instead of opening the table's modal (shared modal in parent). */
  onViewPlan?: (plan: PlanWithFeatures) => void;
}

export default function PlansComparisonTable({
  currentPlanSlug,
  isAdmin = false,
  initialPlans,
  onViewPlan: onViewPlanProp,
}: PlansComparisonTableProps) {
  const { account } = useAuthStateSafe();
  const [plans, setPlans] = useState<PlanWithFeatures[]>(initialPlans ?? []);
  const [allFeatures, setAllFeatures] = useState<BillingFeature[]>([]);
  const [loading, setLoading] = useState(!initialPlans?.length);
  const [viewPlanSlug, setViewPlanSlug] = useState<string | null>(null);
  const [viewPlanInitial, setViewPlanInitial] = useState<PlanWithFeatures | null>(null);

  useEffect(() => {
    if (initialPlans != null && initialPlans.length > 0) {
      setPlans(initialPlans);
      setLoading(false);
      return;
    }
    fetchPlans();
  }, [isAdmin, initialPlans]);

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
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-border-muted border-t-foreground"></div>
          <p className="mt-3 text-xs text-foreground-muted">Loading plans...</p>
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="w-full py-12">
        <div className="text-center">
          <p className="text-xs text-foreground-muted">No plans available</p>
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
        ? (pf as any as PlanFeatureAdmin).feature_id 
        : (pf as PlanFeaturePublic).id;
      
      if (!allFeaturesMap.has(featureId)) {
        // Find the full feature details
        let fullFeature: BillingFeature | undefined;
        
        if (isAdmin) {
          // Admin format: find by feature_id from allFeatures
          fullFeature = allFeatures.find((f) => f.id === (pf as any as PlanFeatureAdmin).feature_id);
          
          // If not found in allFeatures, create a minimal feature from plan data
          // This handles cases where a plan references an inactive feature
          if (!fullFeature) {
            const adminPf = pf as any as PlanFeatureAdmin;
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
            <tr className="border-b border-border">
              <th className="text-left p-[10px] text-xs font-semibold text-foreground sticky left-0 bg-surface z-10">
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
                    className={`text-center p-[10px] text-xs font-semibold text-foreground min-w-[120px] ${
                      isUserActivePlan ? 'bg-green-500/10 dark:bg-green-500/20' : 'bg-surface-muted'
                    }`}
                  >
                    <div className="font-bold text-foreground">{plan.name}</div>
                    <div className="text-[10px] text-foreground-muted mt-0.5">{priceDisplay}</div>
                    {isUserActivePlan && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500 text-white dark:bg-green-400 dark:text-gray-900">
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
              <tr key={feature.id} className="border-b border-border-muted hover:bg-surface-accent transition-colors">
                <td className="p-[10px] text-xs text-foreground sticky left-0 bg-surface z-10">
                  <div className="flex items-center gap-1.5">
                    {feature.emoji && <span className="text-sm">{feature.emoji}</span>}
                    <span className="font-medium">{feature.name}</span>
                    {feature.category && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-accent text-foreground-muted capitalize">
                        {feature.category}
                      </span>
                    )}
                    {!feature.is_active && (
                      <span className="text-[10px] text-foreground-subtle italic">(Soon)</span>
                    )}
                  </div>
                </td>
                {plans.map((plan) => {
                  // Find feature in plan - handle both formats
                  let planFeature: PlanFeatureAdmin | PlanFeaturePublic | undefined;
                  
                  if (isAdmin) {
                    planFeature = (plan.features as any as PlanFeatureAdmin[]).find(
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
                        isUserActivePlan ? 'bg-green-500/10 dark:bg-green-500/20' : ''
                      }`}
                    >
                      {hasFeature ? (
                        <div className="flex flex-col items-center gap-0.5">
                          {limitType === 'boolean' || !limitType ? (
                            <span className="text-green-500 dark:text-green-400 font-semibold">✓</span>
                          ) : limitType === 'unlimited' ? (
                            <span className="text-foreground font-semibold">∞</span>
                          ) : limitType === 'count' && limitValue !== null ? (
                            <span className="text-foreground font-semibold">{limitValue}</span>
                          ) : limitType === 'storage_mb' && limitValue !== null ? (
                            <span className="text-foreground font-semibold text-[10px]">
                              {limitValue >= 1000 
                                ? `${(limitValue / 1000).toFixed(1)}GB`
                                : `${limitValue}MB`}
                            </span>
                          ) : (
                            <span className="text-green-500 dark:text-green-400 font-semibold">✓</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-foreground-subtle">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Last row: View Plan buttons */}
            <tr className="border-b-0 bg-surface-muted/50">
              <td className="p-[10px] text-xs font-medium text-foreground sticky left-0 bg-surface-muted/50 z-10">
                —
              </td>
              {plans.map((plan) => {
                const isUserActivePlan = currentPlanSlug && plan.slug.toLowerCase() === currentPlanSlug.toLowerCase();
                return (
                  <td
                    key={plan.id}
                    className={`text-center p-[10px] ${isUserActivePlan ? 'bg-green-500/10 dark:bg-green-500/20' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (onViewPlanProp) {
                          onViewPlanProp(plan);
                        } else {
                          setViewPlanInitial(plan);
                          setViewPlanSlug(plan.slug);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      View Plan
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {!onViewPlanProp && viewPlanSlug && (
        <PlanPaymentModal
          planSlug={viewPlanSlug}
          isOpen={!!viewPlanSlug}
          onClose={() => {
            setViewPlanSlug(null);
            setViewPlanInitial(null);
          }}
          account={account ?? undefined}
          initialPlan={
            viewPlanInitial && viewPlanInitial.slug.toLowerCase() === viewPlanSlug.toLowerCase()
              ? viewPlanInitial
              : undefined
          }
        />
      )}
    </div>
  );
}
