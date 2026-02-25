'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import PlanPaymentModal from '@/components/billing/PlanPaymentModal';
import type { PlanWithFeatures } from '@/lib/billing/types';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import { UserIcon } from '@heroicons/react/24/outline';

const TAGLINES: Record<string, string> = {
  hobby: 'Browse & discover your city',
  contributor: 'Build & own your presence',
};

const DISPLAY_NAMES: Record<string, string> = {
  hobby: 'Public',
  contributor: 'Contributor',
};

/** Display label overrides for specific features (slug -> label) */
const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  profile_gold: 'Gold Profile Border',
};

function formatMonthly(cents: number): string {
  if (cents === 0) return '$0/mo';
  return `$${Math.round(cents / 100)}/mo`;
}

function formatYearly(cents: number): string {
  if (cents === 0) return '$0/yr';
  return `$${Math.round(cents / 100)}/yr`;
}

/** Plan feature as returned by GET /api/billing/plans (includes limit fields) */
type PlanFeatureItem = PlanWithFeatures['features'][number] & {
  limit_value?: number | null;
  limit_type?: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
};

function getMergedFeatures(plans: PlanWithFeatures[]): PlanFeatureItem[] {
  const bySlug = new Map<string, PlanFeatureItem>();
  for (const plan of plans) {
    for (const f of plan.features) {
      const feat = f as PlanFeatureItem;
      if (feat.is_active && !bySlug.has(feat.slug)) {
        bySlug.set(feat.slug, feat);
      }
    }
  }
  return Array.from(bySlug.values()).sort((a, b) => {
    const catA = a.category ?? '';
    const catB = b.category ?? '';
    if (catA !== catB) return catA.localeCompare(catB);
    return a.name.localeCompare(b.name);
  });
}

function getCellValue(plan: PlanWithFeatures, featureSlug: string): string {
  const f = plan.features.find((x) => x.slug === featureSlug) as PlanFeatureItem | undefined;
  if (!f) return '—';
  const lt = f.limit_type;
  const val = f.limit_value;
  if (lt === 'boolean') return '✓';
  if (lt === 'count') return val != null ? `Up to ${val}` : 'Unlimited';
  if (lt === 'storage_mb') return val != null ? `Up to ${val} MB` : '✓';
  if (lt === 'unlimited') return 'Unlimited';
  return '✓';
}

export default function PricingPageClient() {
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [loading, setLoading] = useState(true);
  const [annual, setAnnual] = useState(false);
  const [contributorModalOpen, setContributorModalOpen] = useState(false);
  const [contributorPlan, setContributorPlan] = useState<PlanWithFeatures | null>(null);

  const currentPlanSlug = account?.plan ?? null;
  const subscriptionStatus = (account as { subscription_status?: string | null } | null)?.subscription_status ?? null;
  const isLoggedIn = !!account;
  const isContributor = currentPlanSlug === 'contributor';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/billing/plans');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const all = (data.plans ?? []) as PlanWithFeatures[];
        const filtered = all.filter((p) => p.slug === 'hobby' || p.slug === 'contributor');
        setPlans(filtered);
        const contrib = filtered.find((p) => p.slug === 'contributor') ?? null;
        if (contrib && !cancelled) setContributorPlan(contrib);
      } catch {
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const contributorPlanFromList = plans.find((p) => p.slug === 'contributor');

  const getCtaLabel = (slug: string) => {
    if (!isLoggedIn) {
      return slug === 'hobby' ? 'Get Started Free' : 'Get Started';
    }
    if (slug === 'hobby') {
      return isContributor ? null : 'Current Plan'; // hobby user sees "Current Plan" on hobby card
    }
    if (slug === 'contributor') {
      if (isContributor) return 'Current Plan';
      return 'Upgrade to Contributor';
    }
    return null;
  };

  const handleCtaClick = (slug: string) => {
    if (!isLoggedIn) {
      openWelcome();
      return;
    }
    if (slug === 'hobby') {
      if (!isContributor) return; // "Current Plan" — no action
      return;
    }
    if (slug === 'contributor') {
      if (isContributor) return; // "Current Plan" — no action
      setContributorModalOpen(true);
    }
  };

  return (
    <SimplePageLayout
      containerMaxWidth="6xl"
      backgroundColor="bg-[#f4f2ef] dark:bg-surface"
      contentPadding="px-4 sm:px-6 lg:px-8 py-8 sm:py-12"
      hideNav
      hideFooter
    >
      <PageViewTracker />
      {/* Pricing header: logo left, account image right — pulled toward top */}
      <header className="flex items-center justify-between w-full -mt-6 pt-2 mb-6">
        <Link href="/" className="flex items-center" aria-label="Home">
          <Image
            src="/logo.png"
            alt="For the Love of Minnesota"
            width={120}
            height={32}
            className="h-6 w-auto"
            priority
          />
        </Link>
        <div className="flex items-center justify-end w-10 h-10">
          {account ? (
            <Link
              href="/settings/billing"
              className={`inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden shrink-0 transition-opacity hover:opacity-90 ${
                currentPlanSlug === 'contributor'
                  ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                  : 'border border-border-muted dark:border-white/20'
              }`}
              aria-label="Billing and subscription settings"
            >
              <span className="w-full h-full rounded-full overflow-hidden bg-surface flex items-center justify-center">
                {account.image_url ? (
                  <Image
                    src={account.image_url}
                    alt={account.username ?? 'Account'}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                  />
                ) : (
                  <UserIcon className="w-5 h-5 text-foreground-muted" />
                )}
              </span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={openWelcome}
              className="w-10 h-10 rounded-full border border-border-muted dark:border-white/20 bg-surface flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-accent transition-colors"
              aria-label="Sign in"
            >
              <UserIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>
      <div className="space-y-8">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground text-center tracking-tight">
          Simple, transparent pricing
        </h1>

        <div className="flex justify-center">
          <div
            role="group"
            aria-label="Billing period"
            className="inline-flex rounded-lg border border-border-muted dark:border-white/20 bg-surface p-0.5"
          >
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                !annual
                  ? 'bg-lake-blue text-white'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                annual
                  ? 'bg-lake-blue text-white'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              Annual
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto" aria-label="Plans">
          {loading ? (
            <div className="col-span-2 flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-muted border-t-foreground" />
            </div>
          ) : (
            plans.map((plan) => {
              const displayName = DISPLAY_NAMES[plan.slug] ?? plan.name;
              const tagline = TAGLINES[plan.slug] ?? plan.description ?? '';
              const priceLabel = annual
                ? formatYearly(plan.price_yearly_cents ?? 0)
                : formatMonthly(plan.price_monthly_cents);
              const showSaveBadge = annual && plan.slug === 'contributor' && (plan.price_yearly_cents ?? 0) > 0;
              const ctaLabel = getCtaLabel(plan.slug);
              const isCurrent = isLoggedIn && currentPlanSlug === plan.slug;

              return (
                <div
                  key={plan.id}
                  className="flex flex-col rounded-xl border border-border-muted dark:border-white/20 bg-surface p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{displayName}</h2>
                    {showSaveBadge && (
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        Save 20%
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-foreground-muted">{tagline}</p>
                  <div className="mt-4">
                    <span className="text-2xl font-bold text-foreground tabular-nums">{priceLabel}</span>
                  </div>
                  {ctaLabel && (
                    <button
                      type="button"
                      onClick={() => handleCtaClick(plan.slug)}
                      className={`mt-6 w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                        isCurrent
                          ? 'bg-surface-accent dark:bg-white/10 text-foreground-muted cursor-default'
                          : plan.slug === 'contributor'
                            ? 'bg-lake-blue text-white hover:bg-lake-blue/90'
                            : 'border border-border-muted dark:border-white/20 text-foreground hover:bg-surface-accent'
                      }`}
                    >
                      {ctaLabel}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </section>

        <section className="max-w-3xl mx-auto" aria-label="Feature comparison">
          <h2 className="text-sm font-medium text-foreground mb-3">Compare plans</h2>
          <div className="overflow-x-auto rounded-lg border border-border-muted dark:border-white/20">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-muted dark:border-white/20 bg-surface-accent/50">
                  <th className="py-3 px-4 font-medium text-foreground">Feature</th>
                  {plans.map((plan) => (
                    <th key={plan.id} className="py-3 px-4 font-medium text-foreground text-center w-28">
                      {DISPLAY_NAMES[plan.slug] ?? plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const mergedFeatures = getMergedFeatures(plans);
                  return mergedFeatures.map((feature, i) => (
                    <tr
                      key={feature.slug}
                      className={`border-border-muted dark:border-white/10 ${
                        i < mergedFeatures.length - 1 ? 'border-b' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-foreground">{FEATURE_DISPLAY_NAMES[feature.slug] ?? feature.name}</td>
                      {plans.map((plan) => (
                        <td key={plan.id} className="py-3 px-4 text-center text-foreground-muted">
                          {getCellValue(plan, feature.slug)}
                        </td>
                      ))}
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {contributorModalOpen && (contributorPlan ?? contributorPlanFromList) && (
        <PlanPaymentModal
          planSlug="contributor"
          isOpen
          onClose={() => setContributorModalOpen(false)}
          account={account ?? undefined}
          initialPlan={contributorPlan ?? contributorPlanFromList ?? undefined}
          currentPlanSlug={currentPlanSlug}
          subscriptionStatus={subscriptionStatus}
          allPlans={plans}
        />
      )}
    </SimplePageLayout>
  );
}
