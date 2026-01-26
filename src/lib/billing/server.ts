/**
 * Server-side billing utilities
 * Fetch billing data on the server for faster page loads
 */

import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';

interface PlanWithFeatures extends BillingPlan {
  features: (BillingFeature & { 
    isInherited: boolean;
    limit_value?: number | null;
    limit_type?: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  })[];
  directFeatureCount: number;
  inheritedFeatureCount: number;
}

/**
 * Fetch all active plans with their features (server-side)
 * Reuses the same logic as /api/billing/plans but runs on the server
 */
export async function getPlansWithFeatures(): Promise<PlanWithFeatures[]> {
  try {
    const supabase = await createServerClientWithAuth(cookies());
    
    // Fetch all active plans
    const { data: plans, error: plansError } = await supabase
      .from('billing_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .returns<BillingPlan[]>();
    
    if (plansError || !plans) {
      console.error('[Server] Error fetching plans:', plansError);
      return [];
    }
    
    // Fetch all active features
    const { data: allFeatures, error: featuresError } = await supabase
      .from('billing_features')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true })
      .returns<BillingFeature[]>();
    
    if (featuresError || !allFeatures) {
      console.error('[Server] Error fetching features:', featuresError);
      return [];
    }
    
    // Build maps for quick lookup
    const featuresMap = new Map<string, BillingFeature>();
    allFeatures.forEach((f) => {
      featuresMap.set(f.id, f);
    });
    
    // Get all plan-feature relationships with limits
    const { data: planFeatures, error: planFeaturesError } = await supabase
      .from('billing_plan_features')
      .select('plan_id, feature_id, limit_value, limit_type');
    
    if (planFeaturesError) {
      console.error('[Server] Error fetching plan features:', planFeaturesError);
      return [];
    }
    
    // Build maps for plan features and limits
    const directPlanFeaturesMap = new Map<string, Set<string>>();
    const featureLimitsMap = new Map<string, { limit_value: number | null; limit_type: string | null }>();
    
    (planFeatures || []).forEach((pf: any) => {
      const planId = pf.plan_id;
      const featureId = pf.feature_id;
      
      if (!directPlanFeaturesMap.has(planId)) {
        directPlanFeaturesMap.set(planId, new Set());
      }
      directPlanFeaturesMap.get(planId)!.add(featureId);
      
      const key = `${planId}:${featureId}`;
      featureLimitsMap.set(key, {
        limit_value: pf.limit_value,
        limit_type: pf.limit_type,
      });
    });
    
    // Build plans with features
    const plansWithFeatures = plans.map((plan) => {
      // Get directly assigned features
      const directFeatureIds = directPlanFeaturesMap.get(plan.id) || new Set();
      const directFeatures: BillingFeature[] = Array.from(directFeatureIds)
        .map((featureId) => featuresMap.get(featureId))
        .filter((f): f is BillingFeature => f !== undefined);
      
      // Get lower-tier plans for inheritance
      const lowerTierPlans = plans.filter(
        (p) => p.display_order < plan.display_order && p.is_active
      );
      
      // Collect inherited features
      const inheritedFeatureIds = new Set<string>();
      lowerTierPlans.forEach((lowerPlan) => {
        const lowerPlanFeatureIds = directPlanFeaturesMap.get(lowerPlan.id) || new Set();
        lowerPlanFeatureIds.forEach((featureId) => {
          inheritedFeatureIds.add(featureId);
        });
      });
      
      // Get inherited features (exclude duplicates)
      const inheritedFeatures: BillingFeature[] = Array.from(inheritedFeatureIds)
        .filter((featureId) => !directFeatureIds.has(featureId))
        .map((featureId) => featuresMap.get(featureId))
        .filter((f): f is BillingFeature => f !== undefined);
      
      // Combine direct and inherited features WITH LIMIT DATA
      const allPlanFeatures: (BillingFeature & { 
        isInherited: boolean;
        limit_value?: number | null;
        limit_type?: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
      })[] = [
        ...directFeatures.map((f) => {
          const key = `${plan.id}:${f.id}`;
          const limits = featureLimitsMap.get(key);
          return { 
            ...f, 
            isInherited: false,
            limit_value: limits?.limit_value,
            limit_type: limits?.limit_type
          };
        }),
        ...inheritedFeatures.map((f) => ({ ...f, isInherited: true })),
      ];
      
      // Sort features: direct first, then by category and name
      allPlanFeatures.sort((a, b) => {
        if (a.isInherited !== b.isInherited) {
          return a.isInherited ? 1 : -1;
        }
        if (a.category !== b.category) {
          return (a.category || '').localeCompare(b.category || '');
        }
        return a.name.localeCompare(b.name);
      });
      
      return {
        ...plan,
        features: allPlanFeatures,
        directFeatureCount: directFeatures.length,
        inheritedFeatureCount: inheritedFeatures.length,
      };
    });
    
    return plansWithFeatures;
  } catch (error) {
    console.error('[Server] Error fetching plans with features:', error);
    return [];
  }
}

/**
 * Get a specific plan by slug (server-side)
 */
export async function getPlanBySlug(slug: string): Promise<PlanWithFeatures | null> {
  const plans = await getPlansWithFeatures();
  return plans.find((p) => p.slug.toLowerCase() === slug.toLowerCase()) || null;
}
