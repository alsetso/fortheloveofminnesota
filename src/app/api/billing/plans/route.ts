import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { withSecurity } from '@/lib/security/middleware';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';

/**
 * GET /api/billing/plans
 * Public endpoint to fetch all active plans with their features
 * No authentication required - safe for public billing page
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Read-only access to billing schema
 * - Only returns active plans and features
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // Check if user is admin
        let isAdmin = false;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: account } = await supabase
              .from('accounts')
              .select('role')
              .eq('user_id', user.id)
              .limit(1)
              .maybeSingle();
            isAdmin = (account as { role: string } | null)?.role === 'admin';
          }
        } catch {
          // Not authenticated or error - not admin
        }
        
        // Fetch all active plans, filter admin-only plans for non-admins
        let plansQuery = supabase
          .from('billing_plans')
          .select('*')
          .eq('is_active', true);
        
        // Hide admin-only plans from non-admins
        if (!isAdmin) {
          plansQuery = plansQuery.or('is_admin_only.is.null,is_admin_only.eq.false');
        }
        
        const { data: plans, error: plansError } = await plansQuery
          .order('display_order', { ascending: true })
          .returns<BillingPlan[]>();
        
        if (plansError) {
          console.error('[Billing API] Error fetching plans:', plansError);
          return NextResponse.json(
            { error: 'Failed to fetch plans' },
            { status: 500 }
          );
        }
        
        // Fetch all active features for reference
        const { data: allFeatures, error: featuresError } = await supabase
          .from('billing_features')
          .select('*')
          .eq('is_active', true)
          .order('category', { ascending: true })
          .order('name', { ascending: true })
          .returns<BillingFeature[]>();
        
        if (featuresError) {
          console.error('[Billing API] Error fetching features:', featuresError);
          return NextResponse.json(
            { error: 'Failed to fetch features' },
            { status: 500 }
          );
        }
        
        // Build a map of feature_id -> feature for quick lookup
        const featuresMap = new Map<string, BillingFeature>();
        (allFeatures || []).forEach((feature) => {
          featuresMap.set(feature.id, feature);
        });
        
        // Build a map of feature_slug -> feature for quick lookup
        const featuresBySlug = new Map<string, BillingFeature>();
        (allFeatures || []).forEach((feature) => {
          featuresBySlug.set(feature.slug, feature);
        });
        
        // Fetch plan-feature relationships (direct assignments only) WITH LIMITS
        const { data: planFeatures, error: planFeaturesError } = await supabase
          .from('billing_plan_features')
          .select('plan_id, feature_id, limit_value, limit_type')
          .returns<Array<{plan_id: string; feature_id: string; limit_value: number | null; limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null}>>();
        
        if (planFeaturesError) {
          console.error('[Billing API] Error fetching plan-feature relationships:', planFeaturesError);
          return NextResponse.json(
            { error: 'Failed to fetch plan-feature relationships' },
            { status: 500 }
          );
        }
        
        // Build a map of plan_id -> directly assigned feature_ids with limits
        const directPlanFeaturesMap = new Map<string, Set<string>>();
        const featureLimitsMap = new Map<string, {limit_value: number | null; limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null}>();
        
        (planFeatures || []).forEach((pf) => {
          if (!directPlanFeaturesMap.has(pf.plan_id)) {
            directPlanFeaturesMap.set(pf.plan_id, new Set());
          }
          directPlanFeaturesMap.get(pf.plan_id)?.add(pf.feature_id);
          
          // Store limit info with composite key: plan_id:feature_id
          const key = `${pf.plan_id}:${pf.feature_id}`;
          featureLimitsMap.set(key, {
            limit_value: pf.limit_value,
            limit_type: pf.limit_type
          });
        });
        
        // For each plan, get all features (including inherited from lower tiers)
        // Calculate inheritance manually since PostgREST can't access billing schema functions
        const plansWithFeatures = (plans || []).map((plan: BillingPlan) => {
          // Get directly assigned features for this plan
          const directFeatureIds = directPlanFeaturesMap.get(plan.id) || new Set();
          const directFeatures: BillingFeature[] = Array.from(directFeatureIds)
            .map((featureId) => featuresMap.get(featureId))
            .filter((f): f is BillingFeature => f !== undefined);
          
          // Get all lower-tier plans (display_order < current)
          const lowerTierPlans = (plans || []).filter(
            (p: BillingPlan) => p.display_order < plan.display_order && p.is_active
          );
          
          // Collect all features from lower-tier plans (inherited features)
          const inheritedFeatureIds = new Set<string>();
          lowerTierPlans.forEach((lowerPlan: BillingPlan) => {
            const lowerPlanFeatureIds = directPlanFeaturesMap.get(lowerPlan.id) || new Set();
            lowerPlanFeatureIds.forEach((featureId) => {
              inheritedFeatureIds.add(featureId);
            });
          });
          
          // Get inherited features (exclude ones that are also directly assigned)
          const inheritedFeatures: BillingFeature[] = Array.from(inheritedFeatureIds)
            .filter((featureId) => !directFeatureIds.has(featureId)) // Don't duplicate direct features
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
            // Direct features first
            if (a.isInherited !== b.isInherited) {
              return a.isInherited ? 1 : -1;
            }
            // Then by category
            if (a.category !== b.category) {
              return (a.category || '').localeCompare(b.category || '');
            }
            // Then by name
            return a.name.localeCompare(b.name);
          });
          
          const directFeatureCount = directFeatures.length;
          const inheritedFeatureCount = inheritedFeatures.length;
          
          return {
            ...plan,
            features: allPlanFeatures,
            directFeatureCount,
            inheritedFeatureCount,
          };
        });
        
        return NextResponse.json({
          plans: plansWithFeatures,
          // Also return all features for flexibility
          allFeatures: allFeatures || [],
        });
      } catch (error) {
        console.error('[Billing API] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: false, // Public endpoint
      rateLimit: 'public', // Use public rate limit preset
    }
  );
}
