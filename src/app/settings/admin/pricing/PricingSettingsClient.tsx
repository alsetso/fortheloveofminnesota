'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';

/* ─── Types ─── */

interface PlanFeatureRow {
  feature_id: string;
  feature_slug: string;
  feature_name: string;
  limit_value: number | null;
  limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
}

interface PlanWithFeatures extends BillingPlan {
  features: PlanFeatureRow[];
}

/* ─── Limit display helper ─── */

function formatLimit(pf: PlanFeatureRow): string {
  if (pf.limit_type === 'unlimited') return '∞';
  if (pf.limit_type === 'boolean' || !pf.limit_type) return '✓';
  if (pf.limit_type === 'count' && pf.limit_value !== null) return String(pf.limit_value);
  if (pf.limit_type === 'storage_mb' && pf.limit_value !== null) {
    return pf.limit_value >= 1000 ? `${(pf.limit_value / 1000).toFixed(1)}GB` : `${pf.limit_value}MB`;
  }
  return '✓';
}

/* ─── Main Component ─── */

export default function PricingSettingsClient() {
  const { account } = useSettings();
  const router = useRouter();
  const isAdmin = account?.role === 'admin';

  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [allFeatures, setAllFeatures] = useState<BillingFeature[]>([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [showCardPreview, setShowCardPreview] = useState(true);

  // Modals
  const [editingFeature, setEditingFeature] = useState<BillingFeature | null>(null);
  const [creatingFeature, setCreatingFeature] = useState(false);
  const [editingLimits, setEditingLimits] = useState<BillingFeature | null>(null);

  /* ─── Data ─── */

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, featuresRes] = await Promise.all([
        fetch('/api/admin/billing/plans'),
        fetch('/api/admin/billing/features'),
      ]);
      if (plansRes.ok) {
        const d = await plansRes.json();
        setPlans(((d.plans || []) as PlanWithFeatures[]).sort((a, b) => a.display_order - b.display_order));
      }
      if (featuresRes.ok) {
        const d = await featuresRes.json();
        setAllFeatures((Object.values(d.features || {}).flat() as BillingFeature[]).sort((a, b) => {
          const catCmp = (a.category || 'zzz').localeCompare(b.category || 'zzz');
          return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
        }));
      }
    } catch (err) {
      console.error('Failed to load pricing data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin, fetchData]);
  useEffect(() => {
    if (account && !isAdmin) {
      const t = setTimeout(() => router.push('/settings'), 2000);
      return () => clearTimeout(t);
    }
  }, [account, isAdmin, router]);

  /* ─── Derived data ─── */

  const assignedIds = useMemo(() => new Set(plans.flatMap((p) => p.features.map((pf) => pf.feature_id))), [plans]);

  const activeFeatures = useMemo(() => allFeatures.filter((f) => f.is_active), [allFeatures]);
  const inactiveFeatures = useMemo(() => allFeatures.filter((f) => !f.is_active), [allFeatures]);
  const unassignedActive = useMemo(() => activeFeatures.filter((f) => !assignedIds.has(f.id)), [activeFeatures, assignedIds]);

  // Group active features by category for table rendering
  const categoryGroups = useMemo(() => {
    const groups: { category: string; features: BillingFeature[] }[] = [];
    let currentCat = '';
    for (const f of activeFeatures) {
      const cat = f.category || 'Other';
      if (cat !== currentCat) {
        groups.push({ category: cat, features: [] });
        currentCat = cat;
      }
      groups[groups.length - 1].features.push(f);
    }
    return groups;
  }, [activeFeatures]);

  /* ─── Admin gate ─── */

  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="w-5 h-5 text-red-500" />
            <h2 className="text-sm font-semibold text-foreground">Admin Access Required</h2>
          </div>
          <div className="flex items-center gap-2 p-[10px] border border-red-200 dark:border-red-500/50 rounded-md bg-red-50 dark:bg-red-900/20">
            <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs font-medium text-red-700 dark:text-red-400">
              Role: <span className="font-medium">{account?.role || 'user'}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ─── API actions ─── */

  const assignFeature = async (featureId: string, planId: string) => {
    const res = await fetch('/api/admin/billing/plan-features', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId, feature_ids: [featureId] }),
    }).catch(() => null);
    if (res?.ok) await fetchData();
  };

  const removeFeature = async (featureId: string, planId: string) => {
    const res = await fetch('/api/admin/billing/plan-features', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId, feature_id: featureId }),
    }).catch(() => null);
    if (res?.ok) await fetchData();
  };

  const updateLimit = async (featureId: string, planId: string, limitValue: number | null, limitType: string | null) => {
    const res = await fetch('/api/admin/billing/plan-features/limits', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId, feature_id: featureId, limit_value: limitValue, limit_type: limitType }),
    }).catch(() => null);
    if (res?.ok) await fetchData();
  };

  const createFeature = async (data: { slug: string; name: string; description?: string; category?: string; emoji?: string; is_active?: boolean }) => {
    const res = await fetch('/api/admin/billing/features', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => null);
    if (res?.ok) { setCreatingFeature(false); await fetchData(); }
  };

  const updateFeature = async (featureId: string, data: Partial<BillingFeature> & { emoji?: string }) => {
    const res = await fetch(`/api/admin/billing/features/${featureId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => null);
    if (res?.ok) { setEditingFeature(null); await fetchData(); }
  };

  const deactivateFeature = async (featureId: string) => {
    await fetch(`/api/admin/billing/features/${featureId}`, { method: 'DELETE' }).catch(() => null);
    await fetchData();
  };

  const reactivateFeature = async (featureId: string) => {
    await updateFeature(featureId, { is_active: true });
  };

  const togglePlanActive = async (planId: string, active: boolean) => {
    const res = await fetch(`/api/admin/billing/plans/${planId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !active }),
    }).catch(() => null);
    if (res?.ok) await fetchData();
  };

  /* ─── Render ─── */

  return (
    <div className="space-y-3">
      {/* Admin Verification Header */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-semibold text-foreground">Pricing & Features</h2>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/50">
            <CheckCircleIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">Admin Verified</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-[10px] border border-green-200 dark:border-green-500/50 rounded-md bg-green-50 dark:bg-green-900/20">
          <div className="flex-1">
            <p className="text-xs font-medium text-green-700 dark:text-green-400">Admin Access Granted</p>
            <p className="text-[10px] text-green-600 dark:text-green-400/80 mt-0.5">
              Account role: <span className="font-medium">{account?.role}</span>
            </p>
          </div>
        </div>
        <p className="text-xs text-foreground-muted mt-2">
          Manage features assigned to each plan and configure limits. This page is restricted to administrators only.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={() => setCreatingFeature(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-foreground bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors">
          <PlusIcon className="w-3.5 h-3.5" />
          New Feature
        </button>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-foreground-muted bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors disabled:opacity-50">
          <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Pricing Cards Preview */}
      {!loading && plans.length > 0 && (
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Pricing Cards Preview</h3>
            <button
              onClick={() => setShowCardPreview(!showCardPreview)}
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-foreground-muted bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors"
            >
              {showCardPreview ? <EyeSlashIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
              {showCardPreview ? 'Hide' : 'Show'}
            </button>
          </div>
          {showCardPreview && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {plans.map((plan) => {
                const activeCount = plan.features.filter((pf) => activeFeatures.some((af) => af.id === pf.feature_id)).length;
                const price = plan.price_monthly_cents === 0 ? 'Free' : `$${(plan.price_monthly_cents / 100).toFixed(0)}`;
                return (
                  <div key={plan.id} className={`relative border rounded-md p-[10px] transition-colors ${plan.is_active ? 'border-border-muted dark:border-white/10 bg-surface' : 'border-border-muted dark:border-white/10 bg-surface-accent opacity-50'}`}>
                    <button
                      onClick={() => togglePlanActive(plan.id, plan.is_active)}
                      className={`absolute top-2 right-2 w-7 h-4 rounded-full transition-colors ${plan.is_active ? 'bg-green-500' : 'bg-foreground-subtle'}`}
                      title={plan.is_active ? 'Deactivate plan' : 'Activate plan'}
                    >
                      <span className={`block w-3 h-3 rounded-full bg-white transition-transform ${plan.is_active ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                    <div className="pr-8">
                      <p className="text-xs font-semibold text-foreground">{plan.name}</p>
                      {plan.description && <p className="text-[10px] text-foreground-muted mt-0.5 line-clamp-2">{plan.description}</p>}
                    </div>
                    <div className="mt-2">
                      <span className="text-lg font-bold text-foreground">{price}</span>
                      {plan.price_monthly_cents > 0 && <span className="text-[10px] text-foreground-muted">/mo</span>}
                    </div>
                    {plan.price_yearly_cents != null && plan.price_yearly_cents > 0 && (
                      <p className="text-[10px] text-foreground-muted mt-0.5">${(plan.price_yearly_cents / 100).toFixed(0)}/yr</p>
                    )}
                    <div className="mt-2 pt-2 border-t border-border-muted dark:border-white/10">
                      <p className="text-[10px] text-foreground-muted">{activeCount} feature{activeCount !== 1 ? 's' : ''}</p>
                      <ul className="mt-1 space-y-0.5">
                        {plan.features.slice(0, 5).map((pf) => (
                          <li key={pf.feature_id} className="flex items-center gap-1 text-[10px] text-foreground-muted">
                            <CheckCircleIcon className="w-3 h-3 text-green-500 dark:text-green-400 flex-shrink-0" />
                            <span className="truncate">{pf.feature_name}</span>
                            {(pf.limit_type === 'count' || pf.limit_type === 'unlimited') && (
                              <span className="text-foreground-subtle ml-auto flex-shrink-0">{formatLimit(pf)}</span>
                            )}
                          </li>
                        ))}
                        {plan.features.length > 5 && <li className="text-[10px] text-foreground-subtle">+{plan.features.length - 5} more</li>}
                      </ul>
                    </div>
                    {!plan.is_active && (
                      <div className="mt-2 px-1.5 py-0.5 bg-surface-accent border border-border-muted dark:border-white/10 rounded text-center">
                        <span className="text-[10px] font-medium text-foreground-muted">Hidden from users</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px] py-12 text-center">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-border-muted border-t-foreground mb-1.5" />
          <p className="text-xs text-foreground-muted">Loading plans…</p>
        </div>
      ) : (
        <>
          {/* ─── Active Feature × Plan Table ─── */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-[10px] font-semibold text-foreground sticky left-0 bg-surface z-10 min-w-[200px]">
                      Active Features ({activeFeatures.length})
                    </th>
                    {plans.map((plan) => {
                      const count = plan.features.filter((pf) => activeFeatures.some((af) => af.id === pf.feature_id)).length;
                      return (
                        <th key={plan.id} className="text-center p-[10px] font-semibold text-foreground bg-surface-muted min-w-[120px]">
                          <div>{plan.name}</div>
                          <div className="text-[10px] font-normal text-foreground-muted mt-0.5">
                            ${(plan.price_monthly_cents / 100).toFixed(0)}/mo · {count} features
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {categoryGroups.map((group) => (
                    <CategoryGroup
                      key={group.category}
                      category={group.category}
                      features={group.features}
                      plans={plans}
                      onEditFeature={setEditingFeature}
                      onDeactivateFeature={deactivateFeature}
                      onEditLimits={setEditingLimits}
                      onAssign={assignFeature}
                      onRemove={removeFeature}
                    />
                  ))}
                  {activeFeatures.length === 0 && (
                    <tr>
                      <td className="p-[10px] py-8 text-foreground-muted sticky left-0 bg-surface z-10">
                        No active features. Create one above.
                      </td>
                      {plans.map((p) => (
                        <td key={p.id} />
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Unassigned Active Features ─── */}
          {unassignedActive.length > 0 && (
            <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Unassigned ({unassignedActive.length})
              </h3>
              <p className="text-[10px] text-foreground-muted mb-2">Active features not assigned to any plan.</p>
              <div className="space-y-1.5">
                {unassignedActive.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2 border border-border-muted dark:border-white/10 rounded-md bg-surface-accent group">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {f.emoji && <span className="text-sm flex-shrink-0">{f.emoji}</span>}
                      <span className="text-xs font-medium text-foreground truncate">{f.name}</span>
                      {f.category && <span className="text-[10px] text-foreground-muted bg-surface rounded px-1 py-0.5 flex-shrink-0">{f.category}</span>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {plans.map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => assignFeature(f.id, plan.id)}
                          className="px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted bg-surface border border-border-muted dark:border-white/10 rounded hover:bg-green-500/10 hover:text-green-600 hover:border-green-200 dark:hover:border-green-500/30 transition-colors"
                        >
                          + {plan.name}
                        </button>
                      ))}
                      <button onClick={() => setEditingFeature(f)} className="ml-1 text-foreground-muted hover:text-foreground transition-colors" title="Edit"><PencilIcon className="w-3 h-3" /></button>
                      <button onClick={() => deactivateFeature(f.id)} className="text-foreground-muted hover:text-red-500 transition-colors" title="Deactivate"><XMarkIcon className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Inactive Features ─── */}
          {inactiveFeatures.length > 0 && (
            <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Inactive ({inactiveFeatures.length})
              </h3>
              <p className="text-[10px] text-foreground-muted mb-2">Deactivated features hidden from users. Reactivate to add back to plans.</p>
              <div className="space-y-1">
                {inactiveFeatures.map((f) => (
                  <div key={f.id} className="flex items-center justify-between px-2 py-1.5 border border-border-muted dark:border-white/10 rounded-md bg-surface-accent/50">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {f.emoji && <span className="text-sm flex-shrink-0 opacity-50">{f.emoji}</span>}
                      <span className="text-xs text-foreground-muted truncate">{f.name}</span>
                      {f.category && <span className="text-[10px] text-foreground-subtle bg-surface rounded px-1 py-0.5 flex-shrink-0">{f.category}</span>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => reactivateFeature(f.id)}
                        className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded hover:bg-green-500/20 transition-colors"
                      >
                        <ArrowUturnLeftIcon className="w-3 h-3" />
                        Reactivate
                      </button>
                      <button onClick={() => setEditingFeature(f)} className="text-foreground-muted hover:text-foreground transition-colors" title="Edit"><PencilIcon className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Modals ─── */}
      {creatingFeature && <FeatureModal onClose={() => setCreatingFeature(false)} onSave={createFeature} />}
      {editingFeature && <FeatureModal feature={editingFeature} onClose={() => setEditingFeature(null)} onSave={(data) => updateFeature(editingFeature.id, data)} />}
      {editingLimits && (
        <LimitsModal
          feature={editingLimits}
          plans={plans}
          onClose={() => setEditingLimits(null)}
          onSave={async (planLimits) => {
            await Promise.all(planLimits.map((pl) => updateLimit(editingLimits.id, pl.planId, pl.limitValue, pl.limitType)));
            setEditingLimits(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Category Group (table rows) ─── */

function CategoryGroup({
  category,
  features,
  plans,
  onEditFeature,
  onDeactivateFeature,
  onEditLimits,
  onAssign,
  onRemove,
}: {
  category: string;
  features: BillingFeature[];
  plans: PlanWithFeatures[];
  onEditFeature: (f: BillingFeature) => void;
  onDeactivateFeature: (id: string) => void;
  onEditLimits: (f: BillingFeature) => void;
  onAssign: (featureId: string, planId: string) => void;
  onRemove: (featureId: string, planId: string) => void;
}) {
  return (
    <>
      {/* Category separator */}
      <tr>
        <td className="px-[10px] pt-3 pb-1 sticky left-0 bg-surface z-10">
          <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">{category}</span>
        </td>
        {plans.map((p) => (
          <td key={p.id} className="pt-3 pb-1" />
        ))}
      </tr>
      {features.map((feature) => (
        <tr key={feature.id} className="border-b border-border-muted group hover:bg-surface-accent/50 transition-colors">
          {/* Feature name + hover actions */}
          <td className="p-[10px] sticky left-0 bg-surface group-hover:bg-surface-accent/50 z-10 transition-colors">
            <div className="flex items-center gap-1.5">
              {feature.emoji && <span className="text-sm flex-shrink-0">{feature.emoji}</span>}
              <span className="font-medium text-foreground truncate">{feature.name}</span>
              {/* Actions appear on hover */}
              <span className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => onEditLimits(feature)} className="text-foreground-muted hover:text-lake-blue transition-colors p-0.5" title="Edit limits across plans">
                  <PencilIcon className="w-3 h-3" />
                </button>
                <button onClick={() => onEditFeature(feature)} className="text-foreground-muted hover:text-foreground transition-colors p-0.5" title="Edit feature details">
                  <PencilIcon className="w-3 h-3" />
                </button>
                <button onClick={() => onDeactivateFeature(feature.id)} className="text-foreground-muted hover:text-red-500 transition-colors p-0.5" title="Deactivate">
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </span>
            </div>
          </td>
          {/* Plan cells */}
          {plans.map((plan) => {
            const pf = plan.features.find((f) => f.feature_id === feature.id);
            return (
              <td key={plan.id} className="text-center p-[10px]">
                {pf ? (
                  <div className="flex items-center justify-center gap-1 group/cell">
                    {/* Clickable limit — opens limits modal */}
                    <button
                      onClick={() => onEditLimits(feature)}
                      className="text-foreground font-medium hover:text-lake-blue transition-colors"
                      title="Edit limit"
                    >
                      {formatLimit(pf)}
                    </button>
                    {/* Remove button on cell hover */}
                    <button
                      onClick={() => onRemove(feature.id, plan.id)}
                      className="opacity-0 group-hover/cell:opacity-100 text-foreground-muted hover:text-red-500 transition-all p-0.5"
                      title="Remove from plan"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onAssign(feature.id, plan.id)}
                    className="w-full h-full text-foreground-subtle hover:text-green-500 transition-colors"
                    title={`Add to ${plan.name}`}
                  >
                    <PlusIcon className="w-3.5 h-3.5 mx-auto" />
                  </button>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

/* ─── Feature Modal ─── */

function FeatureModal({
  feature,
  onClose,
  onSave,
}: {
  feature?: BillingFeature;
  onClose: () => void;
  onSave: (data: { slug: string; name: string; description?: string; category?: string; emoji?: string; is_active?: boolean }) => void;
}) {
  const [slug, setSlug] = useState(feature?.slug ?? '');
  const [name, setName] = useState(feature?.name ?? '');
  const [description, setDescription] = useState(feature?.description ?? '');
  const [category, setCategory] = useState(feature?.category ?? '');
  const [emoji, setEmoji] = useState(feature?.emoji ?? '');
  const [isActive, setIsActive] = useState(feature?.is_active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ slug, name, description: description || undefined, category: category || undefined, emoji: emoji || undefined, is_active: isActive });
  };

  const inputCls = 'w-full px-2.5 py-1.5 text-xs bg-surface border border-border-muted dark:border-white/10 rounded-md focus:outline-none focus:ring-1 focus:ring-lake-blue text-foreground placeholder:text-foreground-muted';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px] w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">{feature ? 'Edit Feature' : 'New Feature'}</h3>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground"><XMarkIcon className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-foreground-muted mb-0.5">Slug</label>
              <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} required className={inputCls} placeholder="feature-slug" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-foreground-muted mb-0.5">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="Feature Name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-foreground-muted mb-0.5">Category</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="maps, analytics…" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-foreground-muted mb-0.5">Emoji</label>
              <input type="text" value={emoji} onChange={(e) => setEmoji(e.target.value)} className={inputCls} placeholder="🎯" maxLength={2} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-foreground-muted mb-0.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder="Optional" rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="feat_active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-border-muted" />
            <label htmlFor="feat_active" className="text-xs text-foreground-muted cursor-pointer">Active</label>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-foreground-muted bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-xs font-medium text-foreground bg-lake-blue hover:bg-lake-blue/80 rounded-md transition-colors">{feature ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Limits Modal (all plans at once) ─── */

interface PlanLimitEntry {
  planId: string;
  planName: string;
  assigned: boolean;
  limitType: string;
  limitValue: string;
}

function LimitsModal({
  feature,
  plans,
  onClose,
  onSave,
}: {
  feature: BillingFeature;
  plans: PlanWithFeatures[];
  onClose: () => void;
  onSave: (planLimits: Array<{ planId: string; limitValue: number | null; limitType: string | null }>) => void;
}) {
  const [entries, setEntries] = useState<PlanLimitEntry[]>(() =>
    plans.map((plan) => {
      const pf = plan.features.find((f) => f.feature_id === feature.id);
      return {
        planId: plan.id,
        planName: plan.name,
        assigned: Boolean(pf),
        limitType: pf?.limit_type ?? 'boolean',
        limitValue: pf?.limit_value?.toString() ?? '',
      };
    }),
  );

  const update = (planId: string, field: 'limitType' | 'limitValue', value: string) => {
    setEntries((prev) => prev.map((e) => (e.planId === planId ? { ...e, [field]: value } : e)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = entries
      .filter((e) => e.assigned)
      .map((e) => ({
        planId: e.planId,
        limitValue: e.limitType === 'count' || e.limitType === 'storage_mb' ? (e.limitValue ? Number(e.limitValue) : null) : null,
        limitType: e.limitType || null,
      }));
    onSave(result);
  };

  const inputCls = 'w-full px-2 py-1 text-xs bg-surface border border-border-muted dark:border-white/10 rounded-md focus:outline-none focus:ring-1 focus:ring-lake-blue text-foreground';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px] w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {feature.emoji && <span className="mr-1">{feature.emoji}</span>}
              {feature.name} — Limits
            </h3>
            <p className="text-[10px] text-foreground-muted mt-0.5">Configure limits across all assigned plans at once.</p>
          </div>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground"><XMarkIcon className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-1.5">
          {/* Column headers */}
          <div className="grid grid-cols-[100px_1fr_80px] gap-2 px-2 pb-1">
            <span className="text-[10px] font-medium text-foreground-muted">Plan</span>
            <span className="text-[10px] font-medium text-foreground-muted">Type</span>
            <span className="text-[10px] font-medium text-foreground-muted">Value</span>
          </div>
          {entries.map((entry) => (
            <div
              key={entry.planId}
              className={`grid grid-cols-[100px_1fr_80px] gap-2 items-center p-2 border rounded-md transition-colors ${
                entry.assigned
                  ? 'border-border-muted dark:border-white/10 bg-surface'
                  : 'border-border-muted dark:border-white/10 bg-surface-accent/50 opacity-40'
              }`}
            >
              <span className="text-xs font-medium text-foreground truncate">{entry.planName}</span>
              {entry.assigned ? (
                <>
                  <select value={entry.limitType} onChange={(e) => update(entry.planId, 'limitType', e.target.value)} className={inputCls}>
                    <option value="boolean">Boolean</option>
                    <option value="count">Count</option>
                    <option value="storage_mb">Storage MB</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                  {entry.limitType === 'count' || entry.limitType === 'storage_mb' ? (
                    <input
                      type="number"
                      value={entry.limitValue}
                      onChange={(e) => update(entry.planId, 'limitValue', e.target.value)}
                      className={inputCls}
                      placeholder="0"
                      min={0}
                    />
                  ) : (
                    <span className="text-xs text-foreground-muted text-center">
                      {entry.limitType === 'unlimited' ? '∞' : '—'}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-[10px] text-foreground-muted col-span-2">Not assigned</span>
                </>
              )}
            </div>
          ))}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-foreground-muted bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 transition-colors">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-xs font-medium text-foreground bg-lake-blue hover:bg-lake-blue/80 rounded-md transition-colors">Save All</button>
          </div>
        </form>
      </div>
    </div>
  );
}
