'use client';

import { useState, useEffect } from 'react';
import type { BillingFeature, BillingPlan } from '@/lib/billing/types';

interface PlanLimitConfig {
  planId: string;
  planName: string;
  planOrder: number;
  isAssigned: boolean;
  isInherited: boolean;
  limitType: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  limitValue: number | null;
}

interface EditFeatureLimitsModalProps {
  feature: BillingFeature;
  plans: Array<BillingPlan & { 
    display_order: number;
    features?: Array<{ 
      feature_id: string; 
      feature_slug: string;
      limit_value: number | null;
      limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
    }> 
  }>;
  onClose: () => void;
  onSave: (planLimits: Array<{ planId: string; limitValue: number | null; limitType: string | null }>) => Promise<void>;
}

export default function EditFeatureLimitsModal({ feature, plans, onClose, onSave }: EditFeatureLimitsModalProps) {
  const [planLimits, setPlanLimits] = useState<PlanLimitConfig[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Find the lowest tier plan that has this feature
    const sortedPlans = [...plans].sort((a, b) => a.display_order - b.display_order);
    const lowestPlanWithFeature = sortedPlans.find(plan => 
      plan.features?.some(f => f.feature_slug === feature.slug)
    );
    
    // Initialize plan limits from current feature assignments
    const configs: PlanLimitConfig[] = sortedPlans.map(plan => {
      const planFeature = plan.features?.find(f => f.feature_slug === feature.slug);
      const isAssigned = !!planFeature;
      
      // Feature is inherited if it's in a lower-tier plan and current plan is higher tier
      const isInherited = !isAssigned && 
        !!lowestPlanWithFeature && 
        plan.display_order > lowestPlanWithFeature.display_order;
      
      return {
        planId: plan.id,
        planName: plan.name,
        planOrder: plan.display_order,
        isAssigned,
        isInherited,
        limitType: planFeature?.limit_type ?? null,
        limitValue: planFeature?.limit_value ?? null,
      };
    });
    setPlanLimits(configs);
  }, [feature, plans]);

  const updatePlanLimit = (planId: string, field: 'limitType' | 'limitValue', value: any) => {
    setPlanLimits(prev => prev.map(pl => {
      if (pl.planId !== planId) return pl;
      
      if (field === 'limitType') {
        const newType = value as typeof pl.limitType;
        // Auto-adjust limit value based on type
        let newValue = pl.limitValue;
        if (newType === 'unlimited' || newType === null) {
          newValue = null;
        } else if (newType === 'boolean') {
          newValue = 1;
        }
        return { ...pl, limitType: newType, limitValue: newValue };
      }
      
      return { ...pl, [field]: value };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Save limits for assigned OR inherited plans (they should have access)
      const limitsToSave = planLimits
        .filter(pl => pl.isAssigned || pl.isInherited)
        .map(pl => ({
          planId: pl.planId,
          limitValue: pl.limitValue,
          limitType: pl.limitType,
        }));
      
      await onSave(limitsToSave);
      onClose();
    } catch (error) {
      console.error('Error saving limits:', error);
      alert('Failed to save limits');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white border border-gray-200 rounded-md w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Edit Limits: {feature.name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Set different limits for each plan</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 text-xs"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {planLimits.map((planLimit) => {
              const canEdit = planLimit.isAssigned || planLimit.isInherited;
              
              return (
                <div 
                  key={planLimit.planId}
                  className={`border rounded-md p-4 ${
                    planLimit.isAssigned
                      ? 'border-blue-200 bg-blue-50' 
                      : planLimit.isInherited
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">{planLimit.planName}</h4>
                    {planLimit.isInherited && (
                      <span className="text-xs text-green-700 italic">Inherited from lower tier</span>
                    )}
                    {!canEdit && (
                      <span className="text-xs text-gray-500 italic">Not assigned to this plan</span>
                    )}
                  </div>

                  {canEdit && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Limit Type
                        </label>
                        <select
                          value={planLimit.limitType || ''}
                          onChange={(e) => updatePlanLimit(planLimit.planId, 'limitType', e.target.value || null)}
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">No limit set</option>
                          <option value="count">Count (numeric limit)</option>
                          <option value="storage_mb">Storage (MB)</option>
                          <option value="boolean">Boolean (Yes/No)</option>
                          <option value="unlimited">Unlimited</option>
                        </select>
                      </div>

                      {planLimit.limitType && planLimit.limitType !== 'unlimited' && planLimit.limitType !== 'boolean' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Limit Value
                            {planLimit.limitType === 'count' && ' (quantity)'}
                            {planLimit.limitType === 'storage_mb' && ' (megabytes)'}
                          </label>
                          <input
                            type="number"
                            value={planLimit.limitValue || ''}
                            onChange={(e) => updatePlanLimit(planLimit.planId, 'limitValue', e.target.value ? parseInt(e.target.value) : null)}
                            min="0"
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder={planLimit.limitType === 'storage_mb' ? 'e.g., 1000' : 'e.g., 5'}
                          />
                        </div>
                      )}

                      {planLimit.limitType === 'unlimited' && (
                        <div className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                          ∞ This feature will have no limits on this plan
                        </div>
                      )}

                      {planLimit.limitType === 'boolean' && (
                        <div className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                          ✓ Boolean access granted (no numeric limit)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 flex gap-2 justify-end bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Limits'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
