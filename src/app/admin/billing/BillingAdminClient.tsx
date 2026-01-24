'use client';

import { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  AdjustmentsHorizontalIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';
import EditFeatureLimitsModal from '@/components/admin/EditFeatureLimitsModal';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import { useAuthStateSafe } from '@/features/auth';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

interface PlanWithFeatures extends BillingPlan {
  features: Array<{ 
    feature_slug: string; 
    feature_name: string; 
    feature_id: string;
    limit_value: number | null;
    limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  }>;
}

interface FeatureWithPlan extends BillingFeature {
  assigned_plan_id?: string;
  isInherited?: boolean;
  limit_value?: number | null;
  limit_type?: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
}

export default function BillingAdminClient() {
  const { openWelcome } = useAppModalContextSafe();
  const { account, user } = useAuthStateSafe();
  const router = useRouter();
  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [allFeatures, setAllFeatures] = useState<FeatureWithPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFeature, setEditingFeature] = useState<BillingFeature | null>(null);
  const [editingLimitsFeature, setEditingLimitsFeature] = useState<BillingFeature | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [showCreateFeature, setShowCreateFeature] = useState(false);
  const [draggedFeature, setDraggedFeature] = useState<{ id: string; slug: string } | null>(null);
  const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>(null);
  const [expandedInheritedPlanId, setExpandedInheritedPlanId] = useState<string | null>(null);
  const [expandedUpgradedPlanId, setExpandedUpgradedPlanId] = useState<string | null>(null);
  const [isUnassignedSidebarVisible, setIsUnassignedSidebarVisible] = useState(true);

  // Sidebar toggle button for header (must be defined before early returns)
  const sidebarToggleButton = (
    <button
      onClick={() => setIsUnassignedSidebarVisible(!isUnassignedSidebarVisible)}
      className="flex items-center justify-center w-8 h-8 text-white hover:bg-white/10 rounded-md transition-colors"
      title={isUnassignedSidebarVisible ? 'Hide unassigned sidebar' : 'Show unassigned sidebar'}
      type="button"
    >
      <InboxIcon className="w-5 h-5" />
    </button>
  );

  // Verify admin access with current account (only after account loads)
  useEffect(() => {
    // Wait for account to load before checking
    if (!user) {
      return; // Still loading or not signed in - let server-side handle it
    }
    
    // Only redirect if account is loaded AND not admin
    if (account !== undefined && account !== null && account.role !== 'admin') {
      console.warn('[BillingAdmin] Access denied - account role:', account.role);
      router.push('/');
    }
  }, [account, user, router]);

  // Listen for drag events from FeatureCard
  useEffect(() => {
    const handleDragStart = (e: CustomEvent) => {
      setDraggedFeature(e.detail);
    };
    const handleDragEnd = () => {
      setDraggedFeature(null);
    };

    window.addEventListener('featureDragStart', handleDragStart as EventListener);
    window.addEventListener('featureDragEnd', handleDragEnd);

    return () => {
      window.removeEventListener('featureDragStart', handleDragStart as EventListener);
      window.removeEventListener('featureDragEnd', handleDragEnd);
    };
  }, []);

  // Fetch plans and features
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      
      const [plansRes, featuresRes] = await Promise.all([
        fetch('/api/admin/billing/plans'),
        fetch('/api/admin/billing/features'),
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        const sortedPlans = (plansData.plans || []).sort((a: BillingPlan, b: BillingPlan) =>
          a.display_order - b.display_order
        );
        setPlans(sortedPlans);
      }

      if (featuresRes.ok) {
        const featuresData = await featuresRes.json();
        const flatFeatures: BillingFeature[] = Object.values(featuresData.features || {}).flat() as BillingFeature[];
        setAllFeatures(flatFeatures);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  // Get features that exist in lower tiers (to identify upgrades)
  const getFeatureFromLowerTiers = (planId: string, featureSlug: string): { limit_value: number | null; limit_type: string | null } | null => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return null;
    
    const lowerTierPlans = plans.filter((p) => p.display_order < plan.display_order);
    
    // Find the feature in lower tiers (highest tier first)
    for (let i = lowerTierPlans.length - 1; i >= 0; i--) {
      const lowerFeature = lowerTierPlans[i].features?.find((f) => f.feature_slug === featureSlug);
      if (lowerFeature) {
        return {
          limit_value: lowerFeature.limit_value,
          limit_type: lowerFeature.limit_type,
        };
      }
    }
    
    return null;
  };

  // Get directly assigned features for a plan that are NEW (not in lower tiers)
  const getNewFeaturesForPlan = (planId: string): FeatureWithPlan[] => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return [];
    
    const directFeatureSlugs = new Set(plan.features?.map((f) => f.feature_slug) || []);
    const featureLimits = new Map(
      plan.features?.map((f) => [f.feature_slug, { limit_value: f.limit_value, limit_type: f.limit_type }]) || []
    );
    
    return allFeatures
      .filter((f) => {
        if (!directFeatureSlugs.has(f.slug)) return false;
        // Only include if NOT in lower tiers (truly new to this plan)
        return !getFeatureFromLowerTiers(planId, f.slug);
      })
      .map((f) => ({ 
        ...f, 
        assigned_plan_id: planId,
        isInherited: false,
        limit_value: featureLimits.get(f.slug)?.limit_value,
        limit_type: featureLimits.get(f.slug)?.limit_type,
      }));
  };

  // Get upgraded features (exist in lower tiers but with higher limits here)
  const getUpgradedFeaturesForPlan = (planId: string): Array<FeatureWithPlan & { previousLimit: number | null; increase: number | null }> => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return [];
    
    const directFeatureSlugs = new Set(plan.features?.map((f) => f.feature_slug) || []);
    const featureLimits = new Map(
      plan.features?.map((f) => [f.feature_slug, { limit_value: f.limit_value, limit_type: f.limit_type }]) || []
    );
    
    return allFeatures
      .filter((f) => {
        if (!directFeatureSlugs.has(f.slug)) return false;
        // Only include if EXISTS in lower tiers (upgraded)
        return !!getFeatureFromLowerTiers(planId, f.slug);
      })
      .map((f) => {
        const currentLimits = featureLimits.get(f.slug);
        const previousLimits = getFeatureFromLowerTiers(planId, f.slug);
        
        let increase: number | null = null;
        if (currentLimits?.limit_type === 'count' && previousLimits?.limit_type === 'count') {
          const current = currentLimits.limit_value || 0;
          const previous = previousLimits.limit_value || 0;
          increase = current - previous;
        }
        
        return { 
          ...f, 
          assigned_plan_id: planId,
          isInherited: false,
          limit_value: currentLimits?.limit_value,
          limit_type: currentLimits?.limit_type,
          previousLimit: previousLimits ? previousLimits.limit_value : null,
          increase,
        };
      });
  };

  // Get inherited features from lower tiers
  const getInheritedFeaturesForPlan = (planId: string): FeatureWithPlan[] => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return [];
    
    const lowerTierPlans = plans.filter((p) => p.display_order < plan.display_order);
    const directFeatureSlugs = new Set(plan.features?.map((f) => f.feature_slug) || []);
    
    // Collect features from lower tiers that aren't directly assigned
    const inheritedMap = new Map<string, FeatureWithPlan>();
    
    lowerTierPlans.forEach(lowerPlan => {
      lowerPlan.features?.forEach((f) => {
        if (!directFeatureSlugs.has(f.feature_slug) && !inheritedMap.has(f.feature_slug)) {
          const fullFeature = allFeatures.find((af) => af.slug === f.feature_slug);
          if (fullFeature) {
            inheritedMap.set(f.feature_slug, {
              ...fullFeature,
              isInherited: true,
              limit_value: f.limit_value,
              limit_type: f.limit_type,
            });
          }
        }
      });
    });
    
    return Array.from(inheritedMap.values());
  };

  // Get count of inherited features from lower tiers
  const getInheritedFeatureCount = (planId: string): number => {
    return getInheritedFeaturesForPlan(planId).length;
  };

  // Get unassigned features (includes inactive features for "coming soon")
  const getUnassignedFeatures = (): FeatureWithPlan[] => {
    const allAssignedSlugs = new Set(
      plans.flatMap((p) => p.features?.map((f) => f.feature_slug) || [])
    );
    return allFeatures.filter((f) => !allAssignedSlugs.has(f.slug));
  };

  // Move feature to a plan (with optimistic updates)
  const moveFeatureToPlan = async (featureId: string, targetPlanId: string) => {
    const feature = allFeatures.find((f) => f.id === featureId);
    if (!feature) return;

    // Find current plan (if any)
    const currentPlan = plans.find((p) =>
      p.features?.some((f) => f.feature_slug === feature.slug)
    );

    // Optimistic update: Update state immediately
    const previousPlans = [...plans];
    setPlans((prevPlans) =>
      prevPlans.map((plan) => {
        // Remove from current plan
        if (currentPlan && plan.id === currentPlan.id) {
          return {
            ...plan,
            features: plan.features?.filter((f) => f.feature_slug !== feature.slug) || [],
          };
        }
        // Add to target plan
        if (plan.id === targetPlanId) {
          const alreadyHasFeature = plan.features?.some((f) => f.feature_slug === feature.slug);
          if (!alreadyHasFeature) {
            return {
              ...plan,
              features: [
                ...(plan.features || []),
                {
                  feature_id: featureId,
                  feature_slug: feature.slug,
                  feature_name: feature.name,
                  limit_value: null,
                  limit_type: null,
                },
              ],
            };
          }
        }
        return plan;
      })
    );

    const toastId = toast.loading('Moving feature...');
    
    try {
      // Remove from current plan if exists
      if (currentPlan) {
        const currentFeature = currentPlan.features?.find((f) => f.feature_slug === feature.slug);
        if (currentFeature) {
          const deleteRes = await fetch('/api/admin/billing/plan-features', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan_id: currentPlan.id,
              feature_id: featureId,
            }),
          });

          if (!deleteRes.ok) {
            throw new Error('Failed to remove feature from current plan');
          }
        }
      }

      // Add to target plan
      const res = await fetch('/api/admin/billing/plan-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: targetPlanId,
          feature_ids: [featureId],
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to assign feature');
      }

      // Success - optimistic update already applied
      toast.success('Feature assigned successfully', { id: toastId });
    } catch (error) {
      // Revert optimistic update on error
      console.error('Error moving feature:', error);
      setPlans(previousPlans);
      toast.error(`Failed to move feature: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: toastId });
      // Defensive: server state may be partially updated (delete succeeded, assign failed)
      void fetchData({ silent: true });
    }
  };

  // Remove feature from plan (with optimistic updates)
  const removeFeatureFromPlan = async (featureId: string, planId: string) => {
    const feature = allFeatures.find((f) => f.id === featureId);
    if (!feature) return;

    // Optimistic update: Remove from state immediately
    const previousPlans = [...plans];
    setPlans((prevPlans) => {
      return prevPlans.map((plan) => {
        if (plan.id === planId) {
          return {
            ...plan,
            features: plan.features?.filter((f) => f.feature_slug !== feature.slug) || [],
          };
        }
        return plan;
      });
    });

    const toastId = toast.loading('Removing feature...');

    try {
      const res = await fetch('/api/admin/billing/plan-features', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, feature_id: featureId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to remove feature');
      }

      // Success - optimistic update already applied
      toast.success('Feature removed successfully', { id: toastId });
    } catch (error) {
      // Revert optimistic update on error
      console.error('Error removing feature:', error);
      setPlans(previousPlans);
      toast.error(`Failed to remove feature: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: toastId });
    }
  };

  // Create feature
  const handleCreateFeature = async (featureData: {
    slug: string;
    name: string;
    description?: string;
    category?: string;
    emoji?: string;
    is_active?: boolean;
  }) => {
    const toastId = toast.loading('Creating feature...');
    try {
      const res = await fetch('/api/admin/billing/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(featureData),
      });

      if (res.ok) {
        const data = (await res.json()) as { feature: BillingFeature };
        const created = data.feature;

        setAllFeatures((prev) => {
          const next = prev.some((f) => f.id === created.id)
            ? prev.map((f) => (f.id === created.id ? created : f))
            : [...prev, created];
          // Keep ordering stable
          return next.slice().sort((a, b) => {
            const catA = (a.category || 'uncategorized').toLowerCase();
            const catB = (b.category || 'uncategorized').toLowerCase();
            if (catA !== catB) return catA.localeCompare(catB);
            return (a.name || '').localeCompare(b.name || '');
          });
        });

        toast.success('Feature created successfully', { id: toastId });
        setShowCreateFeature(false);
      } else {
        const error = await res.json();
        toast.error(`Error: ${error.error}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error creating feature:', error);
      toast.error('Failed to create feature', { id: toastId });
    }
  };

  // Update feature
  const handleUpdateFeature = async (featureId: string, updates: Partial<BillingFeature> & { emoji?: string }) => {
    const toastId = toast.loading('Updating feature...');
    try {
      const res = await fetch(`/api/admin/billing/features/${featureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = (await res.json()) as { feature: BillingFeature };
        const updated = data.feature;

        // Update canonical feature list (drives labels in kanban)
        setAllFeatures((prev) =>
          prev.map((f) => (f.id === featureId ? { ...f, ...updated } : f))
        );

        // If slug changed, update plan feature slugs so they keep rendering
        setPlans((prev) =>
          prev.map((p) => ({
            ...p,
            features: (p.features || []).map((pf) =>
              pf.feature_id === featureId
                ? { ...pf, feature_slug: updated.slug, feature_name: updated.name }
                : pf
            ),
          }))
        );

        toast.success('Feature updated successfully', { id: toastId });
        setEditingFeature(null);
      } else {
        const error = await res.json();
        toast.error(`Error: ${error.error}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error updating feature:', error);
      toast.error('Failed to update feature', { id: toastId });
    }
  };

  // Update feature limits across multiple plans
  const handleUpdateFeatureLimits = async (
    featureId: string,
    planLimits: Array<{ planId: string; limitValue: number | null; limitType: string | null }>
  ) => {
    const toastId = toast.loading('Updating feature limits...');
    
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('[BillingAdminClient] Updating feature limits:', { featureId, planLimits });
      }
      
      // Update each plan-feature limit
      await Promise.all(
        planLimits.map(async ({ planId, limitValue, limitType }) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('[BillingAdminClient] Sending update request:', {
              plan_id: planId,
              feature_id: featureId,
              limit_value: limitValue,
              limit_type: limitType,
            });
          }
          
          const res = await fetch('/api/admin/billing/plan-features/limits', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan_id: planId,
              feature_id: featureId,
              limit_value: limitValue,
              limit_type: limitType,
            }),
          });

          if (!res.ok) {
            const error = await res.json();
            console.error('[BillingAdminClient] Update failed:', {
              status: res.status,
              error,
              planId,
              featureId,
            });
            throw new Error(`[${res.status}] ${error.error || error.message || 'Failed to update limits'}`);
          }
          
          const result = await res.json();
          if (process.env.NODE_ENV === 'development') {
            console.log('[BillingAdminClient] Update successful:', result);
          }
        })
      );

      // Apply updated limits locally (no full refresh)
      const normalizeLimitType = (
        t: string | null
      ): PlanWithFeatures['features'][number]['limit_type'] => {
        if (t === 'count' || t === 'storage_mb' || t === 'boolean' || t === 'unlimited') return t;
        return null;
      };

      const featureMeta = allFeatures.find((f) => f.id === featureId);

      setPlans((prev) =>
        prev.map((plan) => {
          const update = planLimits.find((pl) => pl.planId === plan.id);
          if (!update) return plan;

          const nextLimitType = normalizeLimitType(update.limitType);
          const nextLimitValue = update.limitValue ?? null;

          const hasRow = (plan.features || []).some((f) => f.feature_id === featureId);

          return {
            ...plan,
            features: hasRow
              ? (plan.features || []).map((f) =>
                  f.feature_id === featureId
                    ? { ...f, limit_value: nextLimitValue, limit_type: nextLimitType }
                    : f
                )
              : [
                  ...(plan.features || []),
                  {
                    feature_id: featureId,
                    feature_slug: featureMeta?.slug || featureId,
                    feature_name: featureMeta?.name || 'Feature',
                    limit_value: nextLimitValue,
                    limit_type: nextLimitType,
                  },
                ],
          };
        })
      );

      toast.success('Feature limits updated successfully', { id: toastId });
    } catch (error) {
      console.error('[BillingAdminClient] Error updating feature limits:', error);
      toast.error(`Failed to update limits: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: toastId });
      // Defensive: some RPCs may have succeeded before the failure
      void fetchData({ silent: true });
      throw error;
    }
  };

  // Delete feature
  const handleDeleteFeature = async (featureId: string) => {
    if (!confirm('Are you sure you want to delete this feature?')) return;

    const toastId = toast.loading('Deleting feature...');
    try {
      const res = await fetch(`/api/admin/billing/features/${featureId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // API performs a soft delete (is_active=false). Mirror that locally.
        setAllFeatures((prev) =>
          prev.map((f) => (f.id === featureId ? { ...f, is_active: false } : f))
        );
        toast.success('Feature deleted successfully', { id: toastId });
      } else {
        const error = await res.json();
        toast.error(`Error: ${error.error}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error deleting feature:', error);
      toast.error('Failed to delete feature', { id: toastId });
    }
  };

  // Get plan index for navigation
  const getPlanIndex = (planId: string): number => {
    return plans.findIndex((p) => p.id === planId);
  };

  if (loading) {
    return (
      <>
        <PageViewTracker />
        <PageWrapper
          headerContent={sidebarToggleButton}
          searchComponent={
            <MapSearchInput
              onLocationSelect={() => {}}
            />
          }
          accountDropdownProps={{
            onAccountClick: () => {},
            onSignInClick: openWelcome,
          }}
          searchResultsComponent={<SearchResults />}
        >
          <div className="min-h-screen bg-gray-50 p-[10px]">
            <div className="text-center py-12">
              <p className="text-xs text-gray-600">Loading...</p>
            </div>
          </div>
        </PageWrapper>
      </>
    );
  }

  // Show unauthorized message if not admin (only if account is loaded)
  if (user && account && account.role !== 'admin') {
    return (
      <>
        <PageViewTracker />
        <PageWrapper
          headerContent={sidebarToggleButton}
          searchComponent={
            <MapSearchInput
              onLocationSelect={() => {}}
            />
          }
          accountDropdownProps={{
            onAccountClick: () => {},
            onSignInClick: openWelcome,
          }}
          searchResultsComponent={<SearchResults />}
        >
          <div className="min-h-screen bg-gray-50 p-[10px]">
            <div className="max-w-md mx-auto mt-12">
              <div className="bg-white border border-red-200 rounded-md p-[10px]">
                <h2 className="text-sm font-semibold text-red-900 mb-2">Access Denied</h2>
                <p className="text-xs text-red-700">
                  This page requires admin access. Please sign in with an admin account.
                </p>
              </div>
            </div>
          </div>
        </PageWrapper>
      </>
    );
  }

  const unassignedFeatures = getUnassignedFeatures();

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: '12px',
            padding: '10px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <PageViewTracker />
      <PageWrapper
        headerContent={sidebarToggleButton}
        searchComponent={
          <MapSearchInput
            onLocationSelect={() => {}}
          />
        }
        accountDropdownProps={{
          onAccountClick: () => {},
          onSignInClick: openWelcome,
        }}
        searchResultsComponent={<SearchResults />}
      >
        <div className="min-h-screen bg-gray-50 p-[10px]">
          <div className="flex gap-3 h-[calc(100vh-4rem-20px)]">
        {/* Left Sidebar - Unassigned Features (Toggleable) */}
        {isUnassignedSidebarVisible && (
        <div className="w-[32rem] flex flex-col">
          <div className="p-[10px] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Unassigned</h2>
            <button
              onClick={() => setShowCreateFeature(true)}
              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
              title="Create Feature"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
          <div
            className="flex-1 overflow-y-auto p-[10px] space-y-2 min-h-[100px]"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.add('bg-gray-50', 'border-2', 'border-dashed', 'border-gray-300', 'rounded-md');
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX;
              const y = e.clientY;
              if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                e.currentTarget.classList.remove('bg-gray-50', 'border-2', 'border-dashed', 'border-gray-300', 'rounded-md');
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove('bg-gray-50', 'border-2', 'border-dashed', 'border-gray-300', 'rounded-md');
              
              if (draggedFeature) {
                // Remove from current plan to make it unassigned
                const currentPlan = plans.find((p) =>
                  p.features?.some((f) => f.feature_slug === draggedFeature.slug)
                );
                if (currentPlan) {
                  removeFeatureFromPlan(draggedFeature.id, currentPlan.id);
                }
                setDraggedFeature(null);
              }
            }}
          >
            {unassignedFeatures.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">Drop features here to unassign</p>
            ) : (
              unassignedFeatures.map((feature) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  onEdit={(planId) => {
                    setEditingFeature(feature);
                    setEditingPlanId(planId || null);
                  }}
                  onEditLimits={() => setEditingLimitsFeature(feature)}
                  onDelete={() => handleDeleteFeature(feature.id)}
                  onClone={() => {
                    setShowCreateFeature(true);
                    setEditingFeature({
                      ...feature,
                      slug: `${feature.slug}_copy`,
                      name: `${feature.name} (Copy)`,
                      id: '', // Will be generated on create
                    } as BillingFeature);
                  }}
                  plans={plans}
                  showLeftArrow={false}
                  showRightArrow={false}
                  currentPlanId={null}
                  isExpanded={expandedFeatureId === feature.id}
                  onToggleExpand={() => {
                    setExpandedFeatureId(expandedFeatureId === feature.id ? null : feature.id);
                  }}
                />
              ))
            )}
          </div>
        </div>
        )}

        {/* Kanban Columns - Plans */}
        <div className="flex-1 flex gap-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {plans.map((plan, planIndex) => {
            const newFeatures = getNewFeaturesForPlan(plan.id);
            const upgradedFeatures = getUpgradedFeaturesForPlan(plan.id);
            const inheritedFeatures = getInheritedFeaturesForPlan(plan.id);
            const inheritedCount = inheritedFeatures.length;
            const upgradedCount = upgradedFeatures.length;
            const totalDirectCount = newFeatures.length + upgradedFeatures.length;
            const canMoveLeft = planIndex > 0;
            const canMoveRight = planIndex < plans.length - 1;
            const isInheritedExpanded = expandedInheritedPlanId === plan.id;
            const isUpgradedExpanded = expandedUpgradedPlanId === plan.id;

            return (
              <div
                key={plan.id}
                className="w-[32rem] flex flex-col flex-shrink-0"
              >
                {/* Plan Header */}
                <div className="p-[10px]">
                  <div className="text-sm font-semibold text-gray-900">{plan.name}</div>
                  <div className="text-xs text-gray-500">
                    ${(plan.price_monthly_cents / 100).toFixed(2)}/mo
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {totalDirectCount} feature{totalDirectCount !== 1 ? 's' : ''}
                    {upgradedCount > 0 && ` (${upgradedCount} upgraded)`}
                    {inheritedCount > 0 && ` + ${inheritedCount} inherited`}
                  </div>
                </div>

                {/* Features List - Drop Zone */}
                <div
                  className="flex-1 overflow-y-auto p-[10px] space-y-2 min-h-[100px]"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.add('bg-gray-50', 'border-2', 'border-dashed', 'border-gray-300', 'rounded-md');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Only remove if we're actually leaving the drop zone
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX;
                    const y = e.clientY;
                    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                      e.currentTarget.classList.remove('bg-gray-50', 'border-2', 'border-dashed', 'border-gray-300', 'rounded-md');
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('bg-gray-50', 'border-2', 'border-dashed', 'border-gray-300', 'rounded-md');
                    
                    if (draggedFeature) {
                      moveFeatureToPlan(draggedFeature.id, plan.id);
                      setDraggedFeature(null);
                    }
                  }}
                >
                  {totalDirectCount === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">Drop features here</p>
                  ) : (
                    <>
                      {/* New Features (not in lower tiers) */}
                      {newFeatures.map((feature) => (
                        <FeatureCard
                          key={feature.id}
                          feature={feature}
                          onEdit={(planId) => {
                            setEditingFeature(feature);
                            setEditingPlanId(planId || null);
                          }}
                          onEditLimits={() => setEditingLimitsFeature(feature)}
                          onDelete={() => handleDeleteFeature(feature.id)}
                          onClone={() => {
                            setShowCreateFeature(true);
                            setEditingFeature({
                              ...feature,
                              slug: `${feature.slug}_copy`,
                              name: `${feature.name} (Copy)`,
                              id: '',
                            } as BillingFeature);
                          }}
                          plans={plans}
                          showLeftArrow={false}
                          showRightArrow={false}
                          currentPlanId={plan.id}
                          isExpanded={expandedFeatureId === feature.id}
                          onToggleExpand={() => {
                            setExpandedFeatureId(expandedFeatureId === feature.id ? null : feature.id);
                          }}
                          isNew={true}
                        />
                      ))}
                      
                      {/* Upgraded Inherited Section */}
                      {upgradedCount > 0 && (
                        <>
                          <div className="pt-2 mt-2 border-t border-gray-200">
                            <button
                              onClick={() => setExpandedUpgradedPlanId(isUpgradedExpanded ? null : plan.id)}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
                            >
                              <svg
                                className={`w-3 h-3 transition-transform ${isUpgradedExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                              <span>
                                {isUpgradedExpanded ? 'Hide' : 'Show'} {upgradedCount} upgraded inherited
                              </span>
                            </button>
                            
                            {isUpgradedExpanded && (
                              <div className="mt-2 space-y-2">
                                {upgradedFeatures.map((feature) => (
                                  <FeatureCard
                                    key={feature.id}
                                    feature={feature}
                                    onEdit={(planId) => {
                                      setEditingFeature(feature);
                                      setEditingPlanId(planId || null);
                                    }}
                                    onEditLimits={() => setEditingLimitsFeature(feature)}
                                    onDelete={() => handleDeleteFeature(feature.id)}
                                    onClone={() => {
                                      setShowCreateFeature(true);
                                      setEditingFeature({
                                        ...feature,
                                        slug: `${feature.slug}_copy`,
                                        name: `${feature.name} (Copy)`,
                                        id: '',
                                      } as BillingFeature);
                                    }}
                                    plans={plans}
                                    showLeftArrow={false}
                                    showRightArrow={false}
                                    currentPlanId={plan.id}
                                    isExpanded={expandedFeatureId === feature.id}
                                    onToggleExpand={() => {
                                      setExpandedFeatureId(expandedFeatureId === feature.id ? null : feature.id);
                                    }}
                                    isUpgraded={true}
                                    upgradeIncrease={feature.increase}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                  
                  {/* Pure Inherited Features Section */}
                  {inheritedCount > 0 && (
                    <div className="pt-2 mt-2 border-t border-dashed border-gray-300">
                      <button
                        onClick={() => setExpandedInheritedPlanId(isInheritedExpanded ? null : plan.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                      >
                        <svg
                          className={`w-3 h-3 transition-transform ${isInheritedExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>
                          {isInheritedExpanded ? 'Hide' : 'Show'} {inheritedCount} inherited feature{inheritedCount !== 1 ? 's' : ''}
                        </span>
                      </button>
                      
                      {/* Expanded Inherited Features */}
                      {isInheritedExpanded && (
                        <div className="mt-2 space-y-2">
                          {inheritedFeatures.map((feature) => (
                            <FeatureCard
                              key={feature.id}
                              feature={feature}
                              onEdit={(planId) => {
                                setEditingFeature(feature);
                                setEditingPlanId(planId || null);
                              }}
                              onEditLimits={() => setEditingLimitsFeature(feature)}
                              onDelete={() => handleDeleteFeature(feature.id)}
                              onClone={() => {
                                setShowCreateFeature(true);
                                setEditingFeature({
                                  ...feature,
                                  slug: `${feature.slug}_copy`,
                                  name: `${feature.name} (Copy)`,
                                  id: '',
                                } as BillingFeature);
                              }}
                              plans={plans}
                              showLeftArrow={false}
                              showRightArrow={false}
                              currentPlanId={null}
                              isExpanded={expandedFeatureId === feature.id}
                              onToggleExpand={() => {
                                setExpandedFeatureId(expandedFeatureId === feature.id ? null : feature.id);
                              }}
                              isInherited={true}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Feature Limits Modal */}
      {editingLimitsFeature && (
        <EditFeatureLimitsModal
          feature={editingLimitsFeature}
          plans={plans}
          onClose={() => setEditingLimitsFeature(null)}
          onSave={(planLimits) => handleUpdateFeatureLimits(editingLimitsFeature.id, planLimits)}
        />
      )}

      {/* Create Feature Modal */}
      {showCreateFeature && (
        <FeatureModal
          feature={editingFeature || undefined}
          onClose={() => {
            setShowCreateFeature(false);
            setEditingFeature(null);
          }}
          onSave={(data) => {
            handleCreateFeature(data);
            setEditingFeature(null);
          }}
        />
      )}

      {/* Edit Feature Modal */}
      {editingFeature && !showCreateFeature && (
        <FeatureModal
          feature={editingFeature}
          onClose={() => {
            setEditingFeature(null);
            setEditingPlanId(null);
          }}
          onSave={(data) => {
            handleUpdateFeature(editingFeature.id, data);
            setEditingPlanId(null);
          }}
        />
      )}
    </div>
      </PageWrapper>
    </>
  );
}

// Feature Card Component
interface FeatureCardProps {
  feature: FeatureWithPlan;
  onEdit: (planId?: string) => void;
  onEditLimits: () => void;
  onDelete: () => void;
  onClone: () => void;
  plans: PlanWithFeatures[];
  showLeftArrow: boolean;
  showRightArrow: boolean;
  currentPlanId: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isInherited?: boolean;
  isUpgraded?: boolean;
  upgradeIncrease?: number | null;
  isNew?: boolean;
}

function FeatureCard({
  feature,
  onEdit,
  onEditLimits,
  onDelete,
  onClone,
  plans,
  showLeftArrow,
  showRightArrow,
  currentPlanId,
  isExpanded,
  onToggleExpand,
  isInherited = false,
  isUpgraded = false,
  upgradeIncrease = null,
  isNew = false,
}: FeatureCardProps) {
  const isInactive = !feature.is_active;

  return (
    <div
      className={`border rounded-md p-[10px] transition-all relative group ${
        isInherited
          ? 'border-dashed border-gray-300 bg-gray-50/50 opacity-75 cursor-default'
          : isUpgraded
          ? 'border-solid border-blue-200 bg-blue-50/30 hover:bg-blue-50/50 cursor-move'
          : isInactive 
          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' 
          : 'border-gray-200 bg-white hover:bg-gray-50 cursor-move'
      }`}
      draggable={!isExpanded && !isInactive && !isInherited}
      onDragStart={(e) => {
        // Don't start drag if expanded, inactive, or inherited
        if (isExpanded || isInactive || isInherited) {
          e.preventDefault();
          return;
        }
        // Store dragged feature via custom event
        const event = new CustomEvent('featureDragStart', { detail: { id: feature.id, slug: feature.slug } });
        window.dispatchEvent(event);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', feature.id);
        e.currentTarget.style.opacity = '0.5';
      }}
      onDragEnd={(e) => {
        e.currentTarget.style.opacity = isInactive ? '0.6' : '1';
        const event = new CustomEvent('featureDragEnd');
        window.dispatchEvent(event);
      }}
      onClick={(e) => {
        // Don't toggle if clicking on action buttons or if inherited
        if ((e.target as HTMLElement).closest('button, [role="button"], .cursor-pointer') || isInherited) {
          return;
        }
        onToggleExpand();
      }}
      title={isInherited ? 'Inherited from lower tier' : isInactive ? 'Coming Soon' : undefined}
    >
      {/* Feature Name Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {feature.emoji && (
            <span className={`text-sm flex-shrink-0 ${isInactive ? 'opacity-50' : ''}`}>{feature.emoji}</span>
          )}
          <div className={`text-xs font-medium truncate flex items-center gap-2 ${
            isInherited ? 'text-gray-600' : isUpgraded ? 'text-blue-900' : isInactive ? 'text-gray-400' : 'text-gray-900'
          }`}>
            <span>{feature.name}</span>
            {isNew && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 border border-green-300">
                new
              </span>
            )}
            {isUpgraded && upgradeIncrease !== null && upgradeIncrease > 0 && (
              <span className="text-[10px] text-blue-600 font-semibold">+{upgradeIncrease}</span>
            )}
            {isInherited && (
              <span className="text-[10px] text-gray-500 italic">← inherited</span>
            )}
            {isInactive && (
              <span className="text-[10px] text-gray-400 italic">(Coming Soon)</span>
            )}
            {feature.category && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                isInactive 
                  ? 'bg-gray-200 text-gray-400' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {feature.category}
              </span>
            )}
          </div>
        </div>

        {/* Limit Count Badge */}
        {feature.limit_type && (currentPlanId || isInherited) && (
          <div className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${
            isUpgraded
              ? 'bg-blue-100 text-blue-700 border border-blue-300'
              : feature.limit_type === 'unlimited' 
              ? 'bg-green-50 text-green-700 border border-green-200'
              : feature.limit_type === 'boolean'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-gray-100 text-gray-700 border border-gray-200'
          }`}>
            {feature.limit_type === 'unlimited' && '∞'}
            {feature.limit_type === 'count' && feature.limit_value !== null && feature.limit_value}
            {feature.limit_type === 'storage_mb' && feature.limit_value !== null && `${feature.limit_value}MB`}
            {feature.limit_type === 'boolean' && '✓'}
          </div>
        )}
      </div>

      {/* Expanded Content - Shows when clicked */}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
          {feature.description && (
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase mb-0.5">Description</div>
              <div className="text-xs text-gray-700">{feature.description}</div>
            </div>
          )}
          <div>
            <div className="text-[10px] font-medium text-gray-500 uppercase mb-0.5">Slug</div>
            <div className="text-xs text-gray-700 font-mono">{feature.slug}</div>
          </div>
          {feature.category && (
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase mb-0.5">Category</div>
              <div className="text-xs text-gray-700">{feature.category}</div>
            </div>
          )}
          {(currentPlanId || isInherited) && feature.limit_type && (
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase mb-0.5">Limit</div>
              <div className="text-xs text-gray-700">
                {feature.limit_type === 'unlimited' && '∞ Unlimited'}
                {feature.limit_type === 'count' && `Count: ${feature.limit_value || 0}`}
                {feature.limit_type === 'storage_mb' && `Storage: ${feature.limit_value || 0} MB`}
                {feature.limit_type === 'boolean' && 'Boolean (Yes/No)'}
              </div>
            </div>
          )}
          {(currentPlanId || isInherited) && !feature.limit_type && (
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase mb-0.5">Limit</div>
              <div className="text-xs text-gray-700">No limit set</div>
            </div>
          )}
        </div>
      )}

      {/* Actions Row - Hidden by default, shown on hover (disabled for inherited, enabled for upgraded) */}
      {!isInherited && (
        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-all max-h-0 group-hover:max-h-10 overflow-hidden">
        <div
          onClick={(e) => {
            e.stopPropagation();
            onEditLimits();
          }}
          className="cursor-pointer text-gray-500 hover:text-blue-600 transition-colors"
          title="Edit Limits"
        >
          <AdjustmentsHorizontalIcon className="w-3 h-3" />
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onEdit(currentPlanId || undefined);
          }}
          className="cursor-pointer text-gray-500 hover:text-gray-900 transition-colors"
          title="Edit"
        >
          <PencilIcon className="w-3 h-3" />
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onClone();
          }}
          className="cursor-pointer text-gray-500 hover:text-gray-900 transition-colors"
          title="Clone"
        >
          <DocumentDuplicateIcon className="w-3 h-3" />
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="cursor-pointer text-gray-500 hover:text-red-600 transition-colors"
          title="Delete"
        >
          <TrashIcon className="w-3 h-3" />
        </div>
      </div>
      )}
    </div>
  );
}

// Feature Modal Component
interface FeatureModalProps {
  feature?: BillingFeature;
  onClose: () => void;
  onSave: (data: {
    slug: string;
    name: string;
    description?: string;
    category?: string;
    emoji?: string;
    is_active?: boolean;
  }) => void;
}

function FeatureModal({ feature, onClose, onSave }: FeatureModalProps) {
  const [slug, setSlug] = useState(feature?.slug || '');
  const [name, setName] = useState(feature?.name || '');
  const [description, setDescription] = useState(feature?.description || '');
  const [category, setCategory] = useState(feature?.category || '');
  const [emoji, setEmoji] = useState(feature?.emoji || '');
  const [isActive, setIsActive] = useState(feature?.is_active ?? true);

  // Update form when feature prop changes (for clone functionality)
  useEffect(() => {
    if (feature) {
      setSlug(feature.slug || '');
      setName(feature.name || '');
      setDescription(feature.description || '');
      setCategory(feature.category || '');
      setEmoji(feature.emoji || '');
      setIsActive(feature.is_active ?? true);
    } else {
      // Reset form when no feature (new feature)
      setSlug('');
      setName('');
      setDescription('');
      setCategory('');
      setEmoji('');
      setIsActive(true);
    }
  }, [feature]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      slug, 
      name, 
      description: description || undefined, 
      category: category || undefined,
      emoji: emoji || undefined,
      is_active: isActive,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white border border-gray-200 rounded-md p-[10px] w-full max-w-md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {feature && feature.id ? 'Edit Feature' : 'Create Feature'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 text-xs"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="w-full px-[10px] py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder="feature-slug"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-[10px] py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder="Feature Name"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Emoji</label>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="w-full px-[10px] py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder="🎯"
              maxLength={2}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-[10px] py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder="Feature description"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-[10px] py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder="Category (optional)"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
            />
            <label htmlFor="is_active" className="text-xs font-medium text-gray-700 cursor-pointer">
              Active (feature is available)
            </label>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors"
            >
              {feature ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
