/**
 * Billing schema types
 */

export interface BillingPlan {
  id: string;
  slug: string;
  name: string;
  price_monthly_cents: number;
  price_yearly_cents: number | null;
  display_order: number;
  is_active: boolean;
  description: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingFeature {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  emoji: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type FeatureLimitType = 'count' | 'storage_mb' | 'boolean' | 'unlimited';

export interface PlanFeature {
  id: string;
  plan_id: string;
  feature_id: string;
  limit_value: number | null;
  limit_type: FeatureLimitType | null;
  created_at: string;
}

export interface FeatureLimit {
  has_feature: boolean;
  limit_value: number | null;
  limit_type: FeatureLimitType | null;
  is_unlimited: boolean;
}

export type FeatureCategory = 'maps' | 'analytics' | 'content' | 'profile' | string;
