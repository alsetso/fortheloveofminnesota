'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserIcon,
  Cog6ToothIcon,
  MapIcon,
  MapPinIcon,
  EyeIcon,
  DocumentTextIcon,
  FolderIcon,
  HeartIcon,
  UserGroupIcon,
  ShareIcon,
  XMarkIcon,
  CreditCardIcon,
  Squares2X2Icon,
  ArrowRightOnRectangleIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import type { DisplayAccount } from '@/features/auth';
import { AccountService } from '@/features/auth/services/memberService';
import { TRAIT_OPTIONS } from '@/types/profile';
import MenuAccountSettingsForm from '@/features/settings/components/MenuAccountSettingsForm';
import type { ProfileAccount } from '@/types/profile';
import { getLiveLayerLabel, type LiveBoundaryLayerId } from '@/features/map/config';
import AccountAnalytics from '@/components/analytics/AccountAnalytics';

export type AppMenuSubPage = 'profile' | 'settings' | 'invite-friends' | 'plans' | 'plan-detail' | 'billing' | 'time-filter' | 'layers' | 'pin-display' | 'my-pins';

const LIVE_BOUNDARY_LAYERS: LiveBoundaryLayerId[] = ['state', 'county', 'ctu', 'district'];

interface AppMenuProps {
  open: boolean;
  onClose: () => void;
  /** When on /live: single boundary layer to show (one at a time). */
  liveBoundaryLayer?: LiveBoundaryLayerId | null;
  /** When on /live: set which boundary layer is visible; pass same layer to turn off. */
  onLiveBoundaryLayerChange?: (layer: LiveBoundaryLayerId | null) => void;
  /** When on /live: pin display grouping (cluster pins). Controlled from live page. */
  pinDisplayGrouping?: boolean;
  /** When on /live: set pin display grouping. */
  onPinDisplayGroupingChange?: (value: boolean) => void;
  /** When on /live: show only current account's pins on the map. */
  showOnlyMyPins?: boolean;
  /** When on /live: set show only my pins. */
  onShowOnlyMyPinsChange?: (value: boolean) => void;
  /** When on /live: time filter for pins (24h, 7d, or null = all time). */
  timeFilter?: '24h' | '7d' | null;
  /** When on /live: set time filter. */
  onTimeFilterChange?: (value: '24h' | '7d' | null) => void;
}

/** Key metrics for the current account (3x3 grid). */
interface MenuMetrics {
  maps: number;
  mentions: number;
  profileViews: number;
  posts: number;
  collections: number;
  mapViews: number;
  likes: number;
  members: number;
  shared: number;
}

const DEFAULT_METRICS: MenuMetrics = {
  maps: 0,
  mentions: 0,
  profileViews: 0,
  posts: 0,
  collections: 0,
  mapViews: 0,
  likes: 0,
  members: 0,
  shared: 0,
};

/** Live map aggregate info (views, members, pins). */
interface LiveMapInfo {
  views: number | null;
  members: number | null;
  pins: number | null;
}

const DEFAULT_LIVE_MAP_INFO: LiveMapInfo = { views: null, members: null, pins: null };

function formatPlan(plan: string | null | undefined): string {
  if (!plan) return '—';
  return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | null | undefined;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const display = value != null ? value.toLocaleString() : '—';
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-2 flex flex-col items-center justify-center gap-0.5 min-h-[56px]">
      <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
      <span className="text-sm font-semibold text-white tabular-nums">{display}</span>
      <span className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
  );
}

interface AppMenuSubPageContentProps {
  subPage: AppMenuSubPage;
  account: DisplayAccount;
  userEmail: string;
  onClose: () => void;
  /** For Layers sub-page on live: current boundary layer. */
  liveBoundaryLayer?: LiveBoundaryLayerId | null;
  /** For Layers sub-page on live: set boundary layer. */
  onLiveBoundaryLayerChange?: (layer: LiveBoundaryLayerId | null) => void;
  /** For Pin Display sub-page: grouping on/off. */
  pinDisplayGrouping?: boolean;
  /** For Pin Display sub-page: set grouping. */
  onPinDisplayGroupingChange?: (value: boolean) => void;
  /** For My Pins sub-page: show only my pins on map. */
  showOnlyMyPins?: boolean;
  /** For My Pins sub-page: set show only my pins. */
  onShowOnlyMyPinsChange?: (value: boolean) => void;
  /** For My Pins sub-page: list of account's pins (from live map). */
  myPinsList?: MyPinItem[];
  /** For My Pins sub-page: loading state for pins list. */
  myPinsLoading?: boolean;
  /** For My Pins sub-page: called after a pin is deleted (remove from list). */
  onPinDeleted?: (pinId: string) => void;
  /** For Time Filter sub-page: current time filter (24h, 7d, or null = all time). */
  timeFilter?: '24h' | '7d' | null;
  /** For Time Filter sub-page: set time filter. */
  onTimeFilterChange?: (value: '24h' | '7d' | null) => void;
  /** Navigate to another sub-page (e.g. from Plans to Billing). */
  onNavigateToSubPage?: (subPage: AppMenuSubPage) => void;
  /** Selected plan for plan-detail subpage (set when user clicks a plan). */
  selectedPlan?: PlanCardData | null;
  /** When user clicks a plan in Plans subpage, open plan-detail with this plan. */
  onSelectPlan?: (plan: PlanCardData) => void;
  /** When user clicks Back to plans from plan-detail (clears selected plan and shows plans list). */
  onBackToPlanList?: () => void;
}

/** Pin item for My Pins list (matches API map_pins shape). */
export interface MyPinItem {
  id: string;
  map_id: string;
  description: string | null;
  created_at: string;
  mention_type?: { id: string; emoji: string; name: string } | null;
}

/** Pin item for Pin Activity list (all pins from live map). */
export interface PinActivityItem {
  id: string;
  map_id: string;
  description: string | null;
  created_at: string;
  account_id?: string | null;
  mention_type?: { id: string; emoji: string; name: string } | null;
  accounts?: { image_url: string | null; username: string | null; first_name: string | null; last_name: string | null } | null;
}

function accountToProfileAccount(account: NonNullable<DisplayAccount>, userEmail: string): ProfileAccount {
  return {
    ...account,
    email: account.email ?? userEmail ?? null,
    view_count: account.view_count ?? 0,
    search_visibility: account.search_visibility ?? false,
    account_taggable: account.account_taggable ?? false,
    created_at: account.created_at,
  };
}

/** Plan feature from GET /api/billing/plans (with limits). */
interface PlanFeatureItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  emoji: string | null;
  isInherited?: boolean;
  limit_value?: number | null;
  limit_type?: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
}

/** Plan shape from GET /api/billing/plans (with features for detail view). */
interface PlanCardData {
  id: string;
  slug: string;
  name: string;
  price_monthly_cents: number;
  description: string | null;
  display_order: number;
  features?: PlanFeatureItem[];
}

const COMING_SOON_PLAN_SLUGS: string[] = [];
function isComingSoonPlan(slug: string | null | undefined): boolean {
  return COMING_SOON_PLAN_SLUGS.includes((slug ?? '').toLowerCase());
}

function PlansSubPageContent({
  onClose,
  currentPlanSlug,
  onManageBilling,
  onSelectPlan,
}: {
  onClose: () => void;
  currentPlanSlug?: string | null;
  onManageBilling: () => void;
  onSelectPlan?: (plan: PlanCardData) => void;
}) {
  const [plans, setPlans] = useState<PlanCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/billing/plans')
      .then((res) => (res.ok ? res.json() : { plans: [] }))
      .then((data: { plans?: Array<PlanCardData & { features?: PlanFeatureItem[] }> }) => {
        if (!cancelled && data.plans?.length) {
          setPlans(
            data.plans
              .slice()
              .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
              .map((p) => ({
                id: p.id,
                slug: p.slug,
                name: p.name,
                price_monthly_cents: p.price_monthly_cents ?? 0,
                description: p.description ?? null,
                display_order: p.display_order ?? 0,
                features: p.features ?? [],
              }))
          );
        }
      })
      .catch(() => {
        if (!cancelled) setPlans([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const formatPrice = (cents: number) =>
    cents === 0 ? 'Free' : `$${Math.round(cents / 100)}/mo`;

  if (loading) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Loading plans…</p>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 flex-1 rounded-md border border-white/10 bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-400">No plans available.</p>
        <button
          type="button"
          onClick={onManageBilling}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
        >
          Manage Billing
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const activeSlug = (currentPlanSlug ?? '').toLowerCase();

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {plans.map((plan) => {
          const isActive = (plan.slug || '').toLowerCase() === activeSlug;
          const comingSoon = isComingSoonPlan(plan.slug);
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelectPlan?.(plan)}
              className={`w-full text-left rounded-md border p-2 flex flex-col gap-0.5 transition-colors ${
                isActive
                  ? 'border-white/30 bg-white/15 hover:bg-white/20'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }`}
              aria-label={`View ${plan.name} plan details`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">{plan.name}</span>
                <span className="flex items-center gap-1.5">
                  {comingSoon && (
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide px-1.5 py-0.5 rounded border border-white/20 bg-white/5">
                      Coming soon
                    </span>
                  )}
                  <span className="text-xs font-medium text-gray-400 tabular-nums">
                    {formatPrice(plan.price_monthly_cents)}
                    {isActive && (
                      <span className="ml-1.5 text-[10px] text-gray-400">(current)</span>
                    )}
                  </span>
                </span>
              </div>
              {plan.description && (
                <p className="text-xs text-gray-400 line-clamp-2">{plan.description}</p>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onManageBilling}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
      >
        Manage Billing
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function formatFeatureLimit(feature: PlanFeatureItem): string {
  const lt = feature.limit_type;
  const v = feature.limit_value;
  if (lt === 'unlimited') return 'Unlimited';
  if (lt === 'boolean' || !lt) return 'Included';
  if (lt === 'count' && v != null) return String(v);
  if (lt === 'storage_mb' && v != null) return v >= 1000 ? `${(v / 1000).toFixed(1)}GB` : `${v}MB`;
  return 'Included';
}

function PlanDetailContent({
  plan,
  onBackToPlans,
  onManageBilling,
  onClose,
}: {
  plan: PlanCardData;
  onBackToPlans: () => void;
  onManageBilling: () => void;
  onClose?: () => void;
}) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const formatPrice = (cents: number) =>
    cents === 0 ? 'Free' : `$${Math.round(cents / 100)}/mo`;
  const comingSoon = isComingSoonPlan(plan.slug);
  const features = plan.features ?? [];
  const directFeatures = features.filter((f) => !f.isInherited);
  const inheritedFeatures = features.filter((f) => f.isInherited);

  const startCheckout = async () => {
    const slug = plan.slug?.toLowerCase();
    if (slug !== 'contributor') return;
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'contributor',
          period: 'monthly',
          returnUrl: '/billing?plan=contributor',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      setCheckoutError(typeof data?.error === 'string' ? data.error : 'Failed to start checkout.');
    } catch {
      setCheckoutError('Network error. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-white/10 bg-white/5 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white">{plan.name}</span>
          <span className="flex items-center gap-1.5">
            {comingSoon && (
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide px-1.5 py-0.5 rounded border border-white/20 bg-white/5">
                Coming soon
              </span>
            )}
            <span className="text-xs font-medium text-gray-400 tabular-nums">
              {formatPrice(plan.price_monthly_cents)}
            </span>
          </span>
        </div>
        {plan.description && (
          <p className="text-xs text-gray-400">{plan.description}</p>
        )}
      </div>

      {features.length > 0 && (
        <div className="rounded-md border border-white/10 bg-white/5 p-2 flex flex-col gap-1.5">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Features</span>
          <ul className="space-y-1">
            {directFeatures.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 text-xs text-gray-300">
                <span className="flex items-center gap-1.5 min-w-0">
                  {f.emoji && <span>{f.emoji}</span>}
                  <span className="truncate">{f.name}</span>
                </span>
                <span className="flex-shrink-0 tabular-nums text-gray-400">
                  {formatFeatureLimit(f)}
                </span>
              </li>
            ))}
            {inheritedFeatures.length > 0 && (
              <>
                <li className="text-[10px] text-gray-500 pt-0.5 border-t border-white/10 mt-0.5">Also from lower tiers</li>
                {inheritedFeatures.map((f) => (
                  <li key={f.id} className="flex items-center gap-1.5 text-xs text-gray-400">
                    {f.emoji && <span>{f.emoji}</span>}
                    <span className="truncate">{f.name}</span>
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {plan.slug?.toLowerCase() === 'contributor' && !comingSoon && (
          <>
            <button
              type="button"
              onClick={startCheckout}
              disabled={checkoutLoading}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:pointer-events-none"
            >
              {checkoutLoading ? 'Starting checkout…' : 'Upgrade / Checkout'}
              <ChevronRightIcon className="w-4 h-4" />
            </button>
            {checkoutError && (
              <p className="text-xs text-red-400">{checkoutError}</p>
            )}
          </>
        )}
        <button
          type="button"
          onClick={onBackToPlans}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to plans
        </button>
        <button
          type="button"
          onClick={onManageBilling}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
        >
          Manage Billing
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/** Current plan info from GET /api/billing/plans (by slug). */
interface CurrentPlanInfo {
  name: string;
  price_monthly_cents: number;
  price_yearly_cents: number | null;
}

function BillingSubPageContent({
  hasStripeCustomer,
  planSlug,
  onClose,
}: {
  hasStripeCustomer: boolean;
  planSlug?: string | null;
  onClose: () => void;
}) {
  const [currentPlan, setCurrentPlan] = useState<CurrentPlanInfo | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);

  useEffect(() => {
    if (!planSlug) {
      setCurrentPlan(null);
      setPlanLoading(false);
      return;
    }
    let cancelled = false;
    setPlanLoading(true);
    fetch('/api/billing/plans', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { plans: [] }))
      .then((data: { plans?: Array<{ slug: string; name: string; price_monthly_cents: number; price_yearly_cents?: number | null }> }) => {
        if (!cancelled && data.plans?.length && planSlug) {
          const slug = (planSlug ?? '').toLowerCase();
          const plan = data.plans.find((p) => (p.slug ?? '').toLowerCase() === slug);
          if (plan) {
            setCurrentPlan({
              name: plan.name,
              price_monthly_cents: plan.price_monthly_cents ?? 0,
              price_yearly_cents: plan.price_yearly_cents ?? null,
            });
          } else {
            setCurrentPlan({ name: formatPlan(planSlug), price_monthly_cents: 0, price_yearly_cents: null });
          }
        } else if (!cancelled && planSlug) {
          setCurrentPlan({ name: formatPlan(planSlug), price_monthly_cents: 0, price_yearly_cents: null });
        }
      })
      .catch(() => {
        if (!cancelled && planSlug) {
          setCurrentPlan({ name: formatPlan(planSlug), price_monthly_cents: 0, price_yearly_cents: null });
        }
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planSlug]);

  const openManagePortal = async () => {
    setManageLoading(true);
    try {
      const res = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      setManageLoading(false);
    } catch {
      setManageLoading(false);
    }
  };

  const formatBillingRate = (plan: CurrentPlanInfo | null) => {
    if (!plan) return planLoading ? '…' : '—';
    if (plan.price_monthly_cents === 0) return 'Free';
    const monthly = `$${Math.round(plan.price_monthly_cents / 100)}/mo`;
    if (plan.price_yearly_cents != null && plan.price_yearly_cents > 0) {
      return `${monthly} or $${Math.round(plan.price_yearly_cents / 100)}/yr`;
    }
    return monthly;
  };

  const planName = currentPlan?.name ?? (planSlug ? formatPlan(planSlug) : '—');
  const billingRate = formatBillingRate(currentPlan);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-white/10 bg-white/5 p-2 flex flex-col gap-1.5">
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Billing Setup</span>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs text-gray-300">
            <span className="text-gray-500">Current plan</span>
            <span>{planLoading ? '…' : planName}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-gray-300">
            <span className="text-gray-500">Current billing rate</span>
            <span>{billingRate}</span>
          </div>
          {hasStripeCustomer ? (
            <div className="flex items-center gap-2 text-xs text-gray-300 pt-0.5">
              <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" aria-hidden />
              <span>Billing is set up</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-0.5">
              <p className="text-xs text-gray-400">Add a payment method to subscribe or manage your plan.</p>
              <Link
                href="/billing"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-2.5 py-2 text-xs font-medium text-white hover:bg-white/15 transition-colors w-fit"
              >
                Set up billing
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {hasStripeCustomer && (
        <button
          type="button"
          onClick={openManagePortal}
          disabled={manageLoading}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-60"
        >
          {manageLoading ? 'Opening…' : 'Manage'}
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function AppMenuSubPageContent({
  subPage,
  account,
  userEmail,
  onClose,
  liveBoundaryLayer,
  onLiveBoundaryLayerChange,
  pinDisplayGrouping = true,
  onPinDisplayGroupingChange,
  showOnlyMyPins = false,
  onShowOnlyMyPinsChange,
  myPinsList = [],
  myPinsLoading = false,
  onPinDeleted,
  timeFilter = null,
  onTimeFilterChange,
  onNavigateToSubPage,
  selectedPlan,
  onSelectPlan,
  onBackToPlanList,
}: AppMenuSubPageContentProps) {
  const { signOut } = useAuthStateSafe();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      onClose();
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  if (subPage === 'profile') {
    return (
      <div className="space-y-3">
        {/* Profile card: same as main menu card, now in Your Profile sub-page */}
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-white/10">
              {account?.image_url ? (
                <Image
                  src={account.image_url}
                  alt=""
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/60">
                  <UserIcon className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-semibold text-white truncate">
                {account ? AccountService.getDisplayName(account) : '—'}
              </p>
              {account?.username && (
                <p className="text-xs text-gray-400 truncate">@{account.username}</p>
              )}
              <p className="text-xs text-gray-500 capitalize">
                {account ? formatPlan(account.plan) : '—'}
              </p>
            </div>
          </div>
          {account?.bio && (
            <p className="mt-2 text-xs text-gray-400 line-clamp-2">{account.bio}</p>
          )}
          {account?.traits && account.traits.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {account.traits
                .map((traitId) => TRAIT_OPTIONS.find((opt) => opt.id === traitId))
                .filter(Boolean)
                .slice(0, 6)
                .map((opt) => (
                  <span
                    key={opt!.id}
                    className="inline-flex items-center rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300"
                  >
                    {opt!.label}
                  </span>
                ))}
              {account.traits.length > 6 && (
                <span className="text-[10px] text-gray-500">+{account.traits.length - 6}</span>
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {account?.username && (
              <Link
                href={`/${account.username}`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                View full profile
                <ChevronRightIcon className="w-4 h-4" />
              </Link>
            )}
            <Link
              href="/settings"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              {account?.username ? 'Settings' : 'Account settings'}
              <ChevronRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
        {account && (
          <div className="rounded-md border border-white/10 bg-white/5 p-3">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-60 disabled:pointer-events-none"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
    );
  }
  if (subPage === 'settings') {
    if (!account) {
      return (
        <p className="text-xs text-gray-400">Sign in to edit account settings.</p>
      );
    }
    const profileAccount = accountToProfileAccount(account, userEmail);
    return (
      <MenuAccountSettingsForm
        initialAccount={profileAccount}
        userEmail={userEmail}
      />
    );
  }
  if (subPage === 'invite-friends') {
    const livePath = '/live';
    const profilePath = account?.username ? `/${account.username}` : null;
    const copyUrl = (path: string) => {
      const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
      if (typeof navigator?.clipboard?.writeText === 'function') {
        navigator.clipboard.writeText(url);
      }
    };
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-400">
          Invite others to join the live map and add pins.
        </p>
        <div className="space-y-2">
          <div className="rounded-md border border-white/10 bg-white/5 p-2 flex flex-col gap-1.5">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Live map</span>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 text-xs text-gray-300 truncate" title={livePath}>
                {livePath}
              </code>
              <button
                type="button"
                onClick={() => copyUrl(livePath)}
                className="flex-shrink-0 rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
          {profilePath && (
            <div className="rounded-md border border-white/10 bg-white/5 p-2 flex flex-col gap-1.5">
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Profile</span>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 text-xs text-gray-300 truncate" title={profilePath}>
                  {profilePath}
                </code>
                <button
                  type="button"
                  onClick={() => copyUrl(profilePath)}
                  className="flex-shrink-0 rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (subPage === 'plans') {
    return (
      <PlansSubPageContent
        onClose={onClose}
        currentPlanSlug={account?.plan}
        onManageBilling={() => onNavigateToSubPage?.('billing')}
        onSelectPlan={onSelectPlan}
      />
    );
  }
  if (subPage === 'plan-detail' && selectedPlan) {
    return (
      <PlanDetailContent
        plan={selectedPlan}
        onBackToPlans={onBackToPlanList ?? (() => onNavigateToSubPage?.('plans'))}
        onManageBilling={() => onNavigateToSubPage?.('billing')}
        onClose={onClose}
      />
    );
  }
  if (subPage === 'billing') {
    return (
      <BillingSubPageContent
        hasStripeCustomer={!!account?.stripe_customer_id}
        planSlug={account?.plan}
        onClose={onClose}
      />
    );
  }
  if (subPage === 'time-filter') {
    const timeOptions: { value: '24h' | '7d' | null; label: string }[] = [
      { value: '24h', label: '24 hours' },
      { value: '7d', label: '7 days' },
      { value: null, label: 'All time' },
    ];
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-400">
          Filter pins on the map by when they were added.
        </p>
        <div className="flex flex-wrap gap-2">
          {timeOptions.map((opt) => {
            const isOn = timeFilter === opt.value;
            return (
              <button
                key={opt.value ?? 'all'}
                type="button"
                onClick={() => onTimeFilterChange?.(opt.value)}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isOn
                    ? 'border-white/30 bg-white/15 text-white'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                }`}
                aria-pressed={isOn}
                aria-label={opt.label}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (subPage === 'layers') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-400">
          Choose which boundary layer to show on the live map. One at a time; tap again to hide.
        </p>
        {onLiveBoundaryLayerChange != null ? (
          <div className="flex flex-wrap gap-2">
            {LIVE_BOUNDARY_LAYERS.map((layer) => {
              const isOn = liveBoundaryLayer === layer;
              return (
                <button
                  key={layer}
                  type="button"
                  onClick={() => onLiveBoundaryLayerChange(isOn ? null : layer)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isOn
                      ? 'border-white/30 bg-white/15 text-white'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                  }`}
                  aria-pressed={isOn}
                  aria-label={isOn ? `Hide ${getLiveLayerLabel(layer)}` : `Show ${getLiveLayerLabel(layer)}`}
                >
                  {getLiveLayerLabel(layer)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Layer controls are only available on the live map.</p>
        )}
      </div>
    );
  }
  if (subPage === 'pin-display') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-400">
          Control how pins appear on the live map.
        </p>
        <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 py-2 px-[10px]">
          <span className="text-sm text-white">Grouping</span>
          <button
            type="button"
            role="switch"
            aria-checked={pinDisplayGrouping}
            onClick={() => onPinDisplayGroupingChange?.(!pinDisplayGrouping)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border transition-colors ${
              pinDisplayGrouping ? 'border-green-500 bg-green-500' : 'border-white/10 bg-white/5'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                pinDisplayGrouping ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    );
  }
  if (subPage === 'my-pins') {
    // Redirect non-authenticated users back to main menu
    if (!account?.id) {
      return (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            Sign in to view and manage your pins on the live map.
          </p>
        </div>
      );
    }

    const formatDate = (s: string) => {
      try {
        const d = new Date(s);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return '';
      }
    };
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-400">
          Show only your pins on the live map. When off, all public pins are shown.
        </p>
        {account?.id ? (
          <>
            <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 py-2 px-[10px]">
              <span className="text-sm text-white">Show only my pins</span>
              <button
                type="button"
                role="switch"
                aria-checked={showOnlyMyPins}
                onClick={() => onShowOnlyMyPinsChange?.(!showOnlyMyPins)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border transition-colors ${
                  showOnlyMyPins ? 'border-green-500 bg-green-500' : 'border-white/10 bg-white/5'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    showOnlyMyPins ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <div className="border-t border-white/10 pt-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Your pins</p>
              {myPinsLoading ? (
                <p className="text-xs text-gray-500">Loading…</p>
              ) : myPinsList.length === 0 ? (
                <p className="text-xs text-gray-500">You have no pins on the live map.</p>
              ) : (
                <ul className="space-y-1.5 max-h-[240px] overflow-y-auto">
                  {myPinsList.map((pin) => (
                    <li
                      key={pin.id}
                      className="rounded-md border border-white/10 bg-white/5 p-2 flex flex-col gap-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {pin.mention_type?.emoji && (
                            <span className="text-sm flex-shrink-0" aria-hidden>{pin.mention_type.emoji}</span>
                          )}
                          <span className="text-xs font-medium text-white truncate">
                            {pin.mention_type?.name ?? 'Pin'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Link
                            href={`/mention/${pin.id}/edit`}
                            onClick={onClose}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            aria-label={`Edit ${pin.mention_type?.name ?? 'pin'}`}
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/maps/${pin.map_id}/pins/${pin.id}`, { method: 'DELETE', credentials: 'include' });
                                if (res.ok) onPinDeleted?.(pin.id);
                              } catch {
                                // ignore
                              }
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-red-400 hover:bg-white/10 transition-colors"
                            aria-label={`Delete ${pin.mention_type?.name ?? 'pin'}`}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {pin.description && (
                        <p className="text-[11px] text-gray-400 line-clamp-2">{pin.description}</p>
                      )}
                      <p className="text-[10px] text-gray-500">{formatDate(pin.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-500">Sign in to filter the map to your pins.</p>
        )}
      </div>
    );
  }
  return null;
}

/**
 * Full-height menu panel over the app container. Slides in from the left (open) and out to the left (close).
 * Max width 500px, 100dvh, black background. Used on /live when user clicks the account image.
 */
const SUBPAGE_TITLES: Record<AppMenuSubPage, string> = {
  profile: 'Your Profile',
  settings: 'Settings',
  'invite-friends': 'Invite Friends',
  plans: 'Plans',
  'plan-detail': 'Plan Details',
  billing: 'Billing',
  'time-filter': 'Time Filter',
  layers: 'Layers',
  'pin-display': 'Pin Display',
  'my-pins': 'My Pins',
};

export default function AppMenu({ open, onClose, liveBoundaryLayer, onLiveBoundaryLayerChange, pinDisplayGrouping: pinDisplayGroupingProp, onPinDisplayGroupingChange, showOnlyMyPins: showOnlyMyPinsProp, onShowOnlyMyPinsChange, timeFilter: timeFilterProp, onTimeFilterChange }: AppMenuProps) {
  const { account, user } = useAuthStateSafe();
  const userEmail = user?.email ?? '';
  const [subPage, setSubPage] = useState<AppMenuSubPage | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanCardData | null>(null);
  const [internalPinDisplayGrouping, setInternalPinDisplayGrouping] = useState(true);
  const pinDisplayGrouping = pinDisplayGroupingProp ?? internalPinDisplayGrouping;
  const setPinDisplayGrouping = onPinDisplayGroupingChange ?? setInternalPinDisplayGrouping;
  const [internalShowOnlyMyPins, setInternalShowOnlyMyPins] = useState(false);
  const showOnlyMyPins = showOnlyMyPinsProp ?? internalShowOnlyMyPins;
  const setShowOnlyMyPins = onShowOnlyMyPinsChange ?? setInternalShowOnlyMyPins;
  const [internalTimeFilter, setInternalTimeFilter] = useState<'24h' | '7d' | null>(null);
  const timeFilter = timeFilterProp ?? internalTimeFilter;
  const setTimeFilter = onTimeFilterChange ?? setInternalTimeFilter;
  const [myPinsList, setMyPinsList] = useState<MyPinItem[]>([]);
  const [myPinsLoading, setMyPinsLoading] = useState(false);
  const [pinActivityList, setPinActivityList] = useState<PinActivityItem[]>([]);
  const [pinActivityLoading, setPinActivityLoading] = useState(false);
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [pinActivityExpanded, setPinActivityExpanded] = useState(false);
  const [metrics, setMetrics] = useState<MenuMetrics>(DEFAULT_METRICS);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [liveMapInfo, setLiveMapInfo] = useState<LiveMapInfo>(DEFAULT_LIVE_MAP_INFO);
  const [liveMapLoading, setLiveMapLoading] = useState(false);
  const [accountAnalytics, setAccountAnalytics] = useState<{
    liveMentions: number;
    profileViews: number;
    totalPinViews: number;
    totalMentionViews: number;
  } | null>(null);
  const [accountAnalyticsLoading, setAccountAnalyticsLoading] = useState(false);

  const fetchMetrics = useCallback(async (accountId: string) => {
    setMetricsLoading(true);
    try {
      let mapsCount = 0;
      let mentionsCount = 0;
      let postsCount = 0;

      const mapsRes = await fetch(`/api/maps?account_id=${accountId}`);
      if (mapsRes.ok) {
        const data = await mapsRes.json();
        mapsCount = data.maps?.length ?? 0;
      }

      const liveMapRes = await fetch('/api/maps?slug=live');
      if (liveMapRes.ok) {
        const liveData = await liveMapRes.json();
        const liveMap = liveData.maps?.[0];
        const liveMapId = liveMap?.id;
        if (liveMapId) {
          const pinsRes = await fetch(`/api/maps/${liveMapId}/pins`, { credentials: 'include' });
          if (pinsRes.ok) {
            const pinsData = await pinsRes.json();
            const accountPins = (pinsData.pins ?? []).filter((p: { account_id?: string }) => p.account_id === accountId);
            mentionsCount = accountPins.length;
          }
        }
      }

      const postsRes = await fetch(`/api/posts?account_id=${accountId}&limit=100`);
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        postsCount = postsData.posts?.length ?? 0;
      }

      setMetrics((prev) => ({
        ...prev,
        maps: mapsCount,
        mentions: mentionsCount,
        profileViews: account?.view_count ?? prev.profileViews,
        posts: postsCount,
      }));
    } catch {
      setMetrics(DEFAULT_METRICS);
    } finally {
      setMetricsLoading(false);
    }
  }, [account?.view_count]);

  const fetchAccountAnalytics = useCallback(async (accountId: string) => {
    setAccountAnalyticsLoading(true);
    try {
      const response = await fetch('/api/analytics/account', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAccountAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching account analytics:', error);
    } finally {
      setAccountAnalyticsLoading(false);
    }
  }, []);

  const fetchLiveMapInfo = useCallback(async () => {
    setLiveMapLoading(true);
    try {
      const liveRes = await fetch('/api/maps?slug=live');
      if (!liveRes.ok) {
        setLiveMapInfo(DEFAULT_LIVE_MAP_INFO);
        return;
      }
      const liveData = await liveRes.json();
      const liveMap = liveData.maps?.[0];
      const liveMapId = liveMap?.id;
      if (!liveMapId) {
        setLiveMapInfo(DEFAULT_LIVE_MAP_INFO);
        return;
      }
      const [statsRes, pinsRes, membersRes] = await Promise.all([
        fetch(`/api/maps/${liveMapId}/stats`),
        fetch(`/api/maps/${liveMapId}/pins`, { credentials: 'include' }),
        fetch(`/api/maps/${liveMapId}/members`, { credentials: 'include' }),
      ]);
      let views: number | null = null;
      let pins: number | null = null;
      let members: number | null = null;
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        views = statsData.stats?.total_views ?? null;
      }
      if (pinsRes.ok) {
        const pinsData = await pinsRes.json();
        pins = (pinsData.pins ?? []).length;
      }
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        members = (membersData.members ?? []).length;
      }
      setLiveMapInfo({ views, members, pins });
    } catch {
      setLiveMapInfo(DEFAULT_LIVE_MAP_INFO);
    } finally {
      setLiveMapLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && account?.id) {
      if (account.role === 'admin') {
        setMetrics((prev) => ({ ...prev, profileViews: account.view_count ?? 0 }));
        fetchMetrics(account.id);
      }
      fetchLiveMapInfo();
      fetchAccountAnalytics(account.id);
    } else if (!open) {
      setSubPage(null);
      setSelectedPlan(null);
      setMetrics(DEFAULT_METRICS);
      setLiveMapInfo(DEFAULT_LIVE_MAP_INFO);
      setAccountAnalytics(null);
      setMyPinsList([]);
    }
  }, [open, account?.id, account?.view_count, account?.role, fetchMetrics, fetchLiveMapInfo, fetchAccountAnalytics]);

  // Fetch account's pins for My Pins sub-page (live map only)
  useEffect(() => {
    if (!open || subPage !== 'my-pins' || !account?.id) {
      if (subPage !== 'my-pins') setMyPinsList([]);
      return;
    }
    let cancelled = false;
    setMyPinsLoading(true);
    fetch('/api/maps/live/mentions')
      .then((res) => (res.ok ? res.json() : { mentions: [] }))
      .then((data: { mentions?: Array<{ id: string; map_id: string; description: string | null; created_at: string; account_id?: string; mention_type?: { id: string; emoji: string; name: string } | null }> }) => {
        if (cancelled) return;
        const list = (data.mentions || []).filter((m) => m.account_id === account.id);
        setMyPinsList(
          list.map((m) => ({
            id: m.id,
            map_id: m.map_id,
            description: m.description ?? null,
            created_at: m.created_at,
            mention_type: m.mention_type ?? null,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setMyPinsList([]);
      })
      .finally(() => {
        if (!cancelled) setMyPinsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, subPage, account?.id]);

  // Fetch all pins for Pin Activity accordion (live map only)
  useEffect(() => {
    if (!open || !pinActivityExpanded) {
      if (!pinActivityExpanded) setPinActivityList([]);
      return;
    }
    let cancelled = false;
    setPinActivityLoading(true);
    
    // First get the live map ID
    fetch('/api/maps?slug=live')
      .then((res) => (res.ok ? res.json() : { maps: [] }))
      .then((data: { maps?: Array<{ id: string }> }) => {
        if (cancelled) return;
        const liveMap = data.maps?.[0];
        if (!liveMap?.id) {
          setPinActivityList([]);
          setPinActivityLoading(false);
          return;
        }
        
        // Then fetch all pins from the live map
        return fetch(`/api/maps/${liveMap.id}/pins`, { credentials: 'include' });
      })
      .then((res) => {
        if (cancelled || !res) return null;
        return res.ok ? res.json() : { pins: [] };
      })
      .then((data: { pins?: Array<{ id: string; map_id: string; description: string | null; created_at: string; account_id?: string | null; account?: { id: string; username: string | null; first_name: string | null; last_name: string | null; image_url: string | null } | null; mention_type?: { id: string; emoji: string; name: string } | null }> } | null) => {
        if (cancelled || !data) return;
        setPinActivityList(
          (data.pins || []).map((p) => ({
            id: p.id,
            map_id: p.map_id,
            description: p.description ?? null,
            created_at: p.created_at,
            account_id: p.account_id ?? null,
            mention_type: p.mention_type ?? null,
            accounts: p.account ? {
              image_url: p.account.image_url,
              username: p.account.username,
              first_name: p.account.first_name,
              last_name: p.account.last_name,
            } : null,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setPinActivityList([]);
      })
      .finally(() => {
        if (!cancelled) setPinActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pinActivityExpanded]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Move focus out of the panel before closing so aria-hidden on <aside> does not trap focus (a11y)
  const handleClose = useCallback(() => {
    (document.activeElement as HTMLElement)?.blur();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, handleClose]);

  return (
    <>
      {/* Backdrop: closes on click */}
      <div
        role="button"
        tabIndex={-1}
        aria-label="Close menu"
        onClick={handleClose}
        onKeyDown={(e) => e.key === 'Escape' && handleClose()}
        className={`fixed inset-0 z-[3000] bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ touchAction: 'none' }}
      />
      {/* Panel: left-aligned, slides in from left */}
      <aside
        aria-hidden={!open}
        aria-label="App menu"
        className={`fixed left-0 top-0 z-[3010] w-full max-w-[500px] bg-black flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ height: '100dvh' }}
      >
        {/* Header: same size whether menu or sub-page */}
        <div className="flex-shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-2 border-b border-white/10 min-h-[44px]">
          {subPage ? (
            <button
              type="button"
              onClick={() => {
                if (subPage === 'plan-detail') {
                  setSubPage('plans');
                  setSelectedPlan(null);
                } else {
                  setSubPage(null);
                }
              }}
              className="flex items-center justify-center gap-1 min-w-8 h-8 px-2 rounded-md bg-transparent text-white hover:bg-white/10 transition-colors justify-self-start"
              aria-label={subPage === 'plan-detail' ? 'Back to plans' : 'Back to menu'}
            >
              <ChevronLeftIcon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">Back</span>
            </button>
          ) : (
            <Link
              href="/"
              onClick={onClose}
              className="flex items-center justify-center gap-1 min-w-8 h-8 px-2 rounded-md bg-transparent text-red-400 hover:text-red-300 transition-colors justify-self-start"
              aria-label="Leave to homepage"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">Leave</span>
            </Link>
          )}
          <span className="text-sm font-semibold text-white">
            {subPage === 'plan-detail' && selectedPlan ? selectedPlan.name : subPage ? SUBPAGE_TITLES[subPage] : 'Menu'}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center justify-center w-8 h-8 rounded-md bg-transparent text-white hover:bg-transparent transition-colors justify-self-end"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        {!subPage && (
          <>
            {/* Key metrics: collapsible, admin only */}
            {account?.role === 'admin' && (
              <div className="flex-shrink-0 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setMetricsExpanded((e) => !e)}
                  className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-white/5 transition-colors"
                  aria-expanded={metricsExpanded}
                >
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Key metrics</span>
                  {metricsExpanded ? (
                    <ChevronUpIcon className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden />
                  )}
                </button>
                {metricsExpanded && (
                  <div className="px-3 pb-3 pt-0">
                    {accountAnalytics ? (
                      <AccountAnalytics
                        liveMentions={accountAnalytics.liveMentions}
                        profileViews={accountAnalytics.profileViews}
                        totalPinViews={accountAnalytics.totalPinViews}
                        totalMentionViews={accountAnalytics.totalMentionViews}
                        loading={accountAnalyticsLoading}
                        isAdmin={account?.role === 'admin'}
                      />
                    ) : (
                      <AccountAnalytics
                        liveMentions={0}
                        profileViews={0}
                        totalPinViews={0}
                        totalMentionViews={0}
                        loading={true}
                        isAdmin={account?.role === 'admin'}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Pin Activity: collapsible accordion */}
            <div className="flex-shrink-0 border-b border-white/10">
              <button
                type="button"
                onClick={() => setPinActivityExpanded((e) => !e)}
                className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-white/5 transition-colors"
                aria-expanded={pinActivityExpanded}
              >
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pin Activity</span>
                {pinActivityExpanded ? (
                  <ChevronUpIcon className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden />
                ) : (
                  <ChevronDownIcon className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden />
                )}
              </button>
              {pinActivityExpanded && (
                <div className="px-3 pb-3 pt-0">
                  {pinActivityLoading ? (
                    <p className="text-xs text-gray-500">Loading…</p>
                  ) : pinActivityList.length === 0 ? (
                    <p className="text-xs text-gray-500">No pins on the live map.</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-[400px] overflow-y-auto">
                      {pinActivityList.map((pin) => {
                        const formatDate = (s: string) => {
                          try {
                            const d = new Date(s);
                            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                          } catch {
                            return '';
                          }
                        };
                        const accountDisplayName = pin.accounts
                          ? pin.accounts.username || 
                            (pin.accounts.first_name || pin.accounts.last_name
                              ? `${pin.accounts.first_name || ''} ${pin.accounts.last_name || ''}`.trim()
                              : 'Anonymous')
                          : null;
                        return (
                          <li
                            key={pin.id}
                            className="rounded-md border border-white/10 bg-white/5 p-2 flex flex-col gap-0.5"
                          >
                            <div className="flex items-start gap-2">
                              {pin.accounts?.image_url && (
                                <div className="flex-shrink-0 w-6 h-6 rounded-full overflow-hidden bg-white/10">
                                  <Image
                                    src={pin.accounts.image_url}
                                    alt={accountDisplayName || ''}
                                    width={24}
                                    height={24}
                                    className="w-full h-full object-cover"
                                    unoptimized={pin.accounts.image_url.includes('supabase.co')}
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  {pin.mention_type?.emoji && (
                                    <span className="text-sm flex-shrink-0" aria-hidden>{pin.mention_type.emoji}</span>
                                  )}
                                  <span className="text-xs font-medium text-white truncate">
                                    {pin.mention_type?.name ?? 'Pin'}
                                  </span>
                                </div>
                                {accountDisplayName && (
                                  <p className="text-[10px] text-gray-500 mb-0.5">@{accountDisplayName}</p>
                                )}
                                {pin.description && (
                                  <p className="text-[11px] text-gray-400 line-clamp-2 mb-0.5">{pin.description}</p>
                                )}
                                <p className="text-[10px] text-gray-500">{formatDate(pin.created_at)}</p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {/* Live map info: views, members, pins */}
            <div className="flex-shrink-0 border-b border-white/10 p-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Live map</p>
              <div className="grid grid-cols-3 gap-2">
                <MetricCard label="Views" value={liveMapInfo.views} icon={EyeIcon} />
                <MetricCard label="Members" value={liveMapInfo.members} icon={UserGroupIcon} />
                <MetricCard label="Pins" value={liveMapInfo.pins} icon={MapPinIcon} />
              </div>
              {liveMapLoading && (
                <p className="mt-1.5 text-[10px] text-gray-500">Updating…</p>
              )}
            </div>
            {/* Map Settings: Time Filter, Layers, Pin Display, My Pins */}
            <div className="flex-shrink-0 border-b border-white/10 p-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Map Settings</p>
              <div className="mt-1.5 space-y-1">
                <button
                  type="button"
                  onClick={() => setSubPage('time-filter')}
                  className="w-full flex items-center gap-2 rounded-md py-2 px-[10px] text-sm text-white hover:bg-white/5 transition-colors text-left"
                >
                  <ClockIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  Time Filter
                  <ChevronRightIcon className="w-4 h-4 text-gray-500 ml-auto" />
                </button>
                <button
                  type="button"
                  onClick={() => setSubPage('layers')}
                  className="w-full flex items-center gap-2 rounded-md py-2 px-[10px] text-sm text-white hover:bg-white/5 transition-colors text-left"
                >
                  <MapIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  Layers
                  <ChevronRightIcon className="w-4 h-4 text-gray-500 ml-auto" />
                </button>
                <button
                  type="button"
                  onClick={() => setSubPage('pin-display')}
                  className="w-full flex items-center gap-2 rounded-md py-2 px-[10px] text-sm text-white hover:bg-white/5 transition-colors text-left"
                >
                  <MapPinIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  Pin Display
                  <ChevronRightIcon className="w-4 h-4 text-gray-500 ml-auto" />
                </button>
                {account?.id ? (
                  <button
                    type="button"
                    onClick={() => setSubPage('my-pins')}
                    className="w-full flex items-center gap-2 rounded-md py-2 px-[10px] text-sm text-white hover:bg-white/5 transition-colors text-left"
                  >
                    <UserIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    My Pins
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 ml-auto" />
                  </button>
                ) : (
                  <div className="w-full flex items-center gap-2 rounded-md py-2 px-[10px] text-sm text-white/60">
                    <UserIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span>My Pins</span>
                    <span className="text-xs text-gray-500 ml-auto">Sign in required</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {/* Main content: menu list or sub-page (same area size) */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {subPage ? (
            <AppMenuSubPageContent
              subPage={subPage}
              account={account}
              userEmail={userEmail}
              onClose={onClose}
              liveBoundaryLayer={liveBoundaryLayer}
              onLiveBoundaryLayerChange={onLiveBoundaryLayerChange}
              pinDisplayGrouping={pinDisplayGrouping}
              onPinDisplayGroupingChange={setPinDisplayGrouping}
              showOnlyMyPins={showOnlyMyPins}
              onShowOnlyMyPinsChange={setShowOnlyMyPins}
              myPinsList={myPinsList}
              myPinsLoading={myPinsLoading}
              onPinDeleted={(pinId) => setMyPinsList((prev) => prev.filter((p) => p.id !== pinId))}
              timeFilter={timeFilter}
              onTimeFilterChange={setTimeFilter}
              onNavigateToSubPage={setSubPage}
              selectedPlan={selectedPlan}
              onSelectPlan={(plan) => {
                setSelectedPlan(plan);
                setSubPage('plan-detail');
              }}
              onBackToPlanList={() => {
                setSubPage('plans');
                setSelectedPlan(null);
              }}
            />
          ) : (
            <div className="space-y-3">
              <section>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account</p>
                <div className="mt-1.5 space-y-1">
                  <button
                    type="button"
                    onClick={() => setSubPage('profile')}
                    className="w-full flex items-center gap-2 rounded-md py-2 px-[10px] text-sm text-white hover:bg-white/5 transition-colors text-left"
                  >
                    <UserIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    Your Profile
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 ml-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubPage('settings')}
                    className="w-full flex items-center gap-2 rounded-md py-2 px-[10px] text-sm text-white hover:bg-white/5 transition-colors text-left"
                  >
                    <Cog6ToothIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    Settings
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 ml-auto" />
                  </button>
                </div>
              </section>
              <section>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Connect</p>
                <div className="mt-1.5 space-y-1">
                  <button
                    type="button"
                    onClick={() => setSubPage('invite-friends')}
                    className="w-full flex items-center gap-2 rounded-md py-2 px-[10px] text-sm text-white hover:bg-white/5 transition-colors text-left"
                  >
                    <ShareIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    Invite Friends
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 ml-auto" />
                  </button>
                </div>
              </section>
              <section>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plans & Limits</p>
                <div className="mt-1.5 space-y-1">
                  <button
                    type="button"
                    onClick={() => setSubPage('plans')}
                    className="w-full flex items-center gap-2 rounded-md py-2 px-[10px] text-sm text-white hover:bg-white/5 transition-colors text-left"
                  >
                    <Squares2X2Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    Plans
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 ml-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubPage('billing')}
                    className="w-full flex items-center gap-2 rounded-md py-2 px-[10px] text-sm text-white hover:bg-white/5 transition-colors text-left"
                  >
                    <CreditCardIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    Billing
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 ml-auto" />
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
