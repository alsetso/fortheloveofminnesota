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

export interface PlanFeature {
  id: string;
  plan_id: string;
  feature_id: string;
  created_at: string;
}

export type FeatureCategory = 'maps' | 'analytics' | 'content' | 'profile' | string;
