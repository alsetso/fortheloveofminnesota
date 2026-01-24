'use client';

import { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';

interface PlanWithFeatures extends BillingPlan {
  features: Array<{ feature_slug: string; feature_name: string; feature_id: string }>;
}

interface FeatureWithPlan extends BillingFeature {
  assigned_plan_id?: string;
  isInherited?: boolean;
}

export default function BillingAdminClient() {
  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [allFeatures, setAllFeatures] = useState<FeatureWithPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFeature, setEditingFeature] = useState<BillingFeature | null>(null);
  const [showCreateFeature, setShowCreateFeature] = useState(false);
  const [draggedFeature, setDraggedFeature] = useState<{ id: string; slug: string } | null>(null);
  const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>(null);

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

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch plans
      const plansRes = await fetch('/api/admin/billing/plans');
      if (plansRes.ok) {
        const plansData = await plansRes.json();
        const sortedPlans = (plansData.plans || []).sort((a: BillingPlan, b: BillingPlan) => 
          a.display_order - b.display_order
        );
        setPlans(sortedPlans);
      }
      
      // Fetch features
      const featuresRes = await fetch('/api/admin/billing/features');
      if (featuresRes.ok) {
        const featuresData = await featuresRes.json();
        const flatFeatures: BillingFeature[] = Object.values(featuresData.features || {})
          .flat() as BillingFeature[];
        setAllFeatures(flatFeatures);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get directly assigned features for a plan (not inherited)
  // Includes both active and inactive features (inactive shown as "coming soon")
  const getFeaturesForPlan = (planId: string): FeatureWithPlan[] => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return [];
    
    // Get directly assigned features for this plan only
    const directFeatureSlugs = new Set(plan.features?.map((f) => f.feature_slug) || []);
    
    return allFeatures
      .filter((f) => directFeatureSlugs.has(f.slug))
      .map((f) => ({ 
        ...f, 
        assigned_plan_id: planId,
        isInherited: false
      }));
  };

  // Get count of inherited features from lower tiers
  const getInheritedFeatureCount = (planId: string): number => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return 0;
    
    const lowerTierPlans = plans.filter((p) => p.display_order < plan.display_order);
    const directFeatureSlugs = new Set(plan.features?.map((f) => f.feature_slug) || []);
    
    // Count features from lower tiers that aren't directly assigned
    const inheritedSlugs = new Set();
    lowerTierPlans.forEach(lowerPlan => {
      lowerPlan.features?.forEach((f) => {
        if (!directFeatureSlugs.has(f.feature_slug)) {
          inheritedSlugs.add(f.feature_slug);
        }
      });
    });
    
    return inheritedSlugs.size;
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
    setPlans((prevPlans) => {
      return prevPlans.map((plan) => {
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
                },
              ],
            };
          }
        }
        return plan;
      });
    });

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

      // Success - refresh to ensure consistency
      await fetchData();
    } catch (error) {
      // Revert optimistic update on error
      console.error('Error moving feature:', error);
      setPlans(previousPlans);
      alert(`Failed to move feature: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // Success - refresh to ensure consistency
      await fetchData();
    } catch (error) {
      // Revert optimistic update on error
      console.error('Error removing feature:', error);
      setPlans(previousPlans);
      alert(`Failed to remove feature: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    try {
      const res = await fetch('/api/admin/billing/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(featureData),
      });

      if (res.ok) {
        await fetchData();
        setShowCreateFeature(false);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating feature:', error);
      alert('Failed to create feature');
    }
  };

  // Update feature
  const handleUpdateFeature = async (featureId: string, updates: Partial<BillingFeature> & { emoji?: string }) => {
    try {
      const res = await fetch(`/api/admin/billing/features/${featureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        await fetchData();
        setEditingFeature(null);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating feature:', error);
      alert('Failed to update feature');
    }
  };

  // Delete feature
  const handleDeleteFeature = async (featureId: string) => {
    if (!confirm('Are you sure you want to delete this feature?')) return;

    try {
      const res = await fetch(`/api/admin/billing/features/${featureId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting feature:', error);
      alert('Failed to delete feature');
    }
  };

  // Get plan index for navigation
  const getPlanIndex = (planId: string): number => {
    return plans.findIndex((p) => p.id === planId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-[10px]">
        <div className="text-center py-12">
          <p className="text-xs text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const unassignedFeatures = getUnassignedFeatures();

  return (
    <div className="min-h-screen bg-gray-50 p-[10px]">
      <div className="flex gap-3 h-[calc(100vh-4rem-20px)]">
        {/* Left Sidebar - Unassigned Features */}
        <div className="w-64 flex flex-col">
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
                  onEdit={() => setEditingFeature(feature)}
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

        {/* Kanban Columns - Plans */}
        <div className="flex-1 flex gap-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {plans.map((plan, planIndex) => {
            const planFeatures = getFeaturesForPlan(plan.id);
            const inheritedCount = getInheritedFeatureCount(plan.id);
            const canMoveLeft = planIndex > 0;
            const canMoveRight = planIndex < plans.length - 1;

            return (
              <div
                key={plan.id}
                className="w-64 flex flex-col flex-shrink-0"
              >
                {/* Plan Header */}
                <div className="p-[10px]">
                  <div className="text-sm font-semibold text-gray-900">{plan.name}</div>
                  <div className="text-xs text-gray-500">
                    ${(plan.price_monthly_cents / 100).toFixed(2)}/mo
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {planFeatures.length} feature{planFeatures.length !== 1 ? 's' : ''}
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
                  {planFeatures.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">Drop features here</p>
                  ) : (
                    planFeatures.map((feature) => (
                      <FeatureCard
                        key={feature.id}
                        feature={feature}
                        onEdit={() => setEditingFeature(feature)}
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
                        currentPlanId={plan.id}
                        isExpanded={expandedFeatureId === feature.id}
                        onToggleExpand={() => {
                          setExpandedFeatureId(expandedFeatureId === feature.id ? null : feature.id);
                        }}
                      />
                    ))
                  )}
                  {inheritedCount > 0 && (
                    <div className="pt-2 mt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500 text-center">
                        ← {inheritedCount} feature{inheritedCount !== 1 ? 's' : ''} inherited from lower tier{inheritedCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
          onClose={() => setEditingFeature(null)}
          onSave={(data) => handleUpdateFeature(editingFeature.id, data)}
        />
      )}
    </div>
  );
}

// Feature Card Component
interface FeatureCardProps {
  feature: FeatureWithPlan;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
  plans: PlanWithFeatures[];
  showLeftArrow: boolean;
  showRightArrow: boolean;
  currentPlanId: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function FeatureCard({
  feature,
  onEdit,
  onDelete,
  onClone,
  plans,
  showLeftArrow,
  showRightArrow,
  currentPlanId,
  isExpanded,
  onToggleExpand,
}: FeatureCardProps) {
  const isInactive = !feature.is_active;

  return (
    <div
      className={`border border-gray-200 rounded-md p-[10px] transition-all relative group ${
        isInactive 
          ? 'bg-gray-50 opacity-60 cursor-not-allowed' 
          : 'bg-white hover:bg-gray-50 cursor-move'
      }`}
      draggable={!isExpanded && !isInactive}
      onDragStart={(e) => {
        // Don't start drag if expanded or inactive
        if (isExpanded || isInactive) {
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
        // Don't toggle if clicking on action buttons
        if ((e.target as HTMLElement).closest('button, [role="button"], .cursor-pointer')) {
          return;
        }
        onToggleExpand();
      }}
      title={isInactive ? 'Coming Soon' : undefined}
    >
      {/* Feature Name Row */}
      <div className="flex items-center gap-2">
        {feature.emoji && (
          <span className={`text-sm flex-shrink-0 ${isInactive ? 'opacity-50' : ''}`}>{feature.emoji}</span>
        )}
        <div className={`text-xs font-medium truncate flex items-center gap-2 ${isInactive ? 'text-gray-400' : 'text-gray-900'}`}>
          <span>{feature.name}</span>
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
        </div>
      )}

      {/* Actions Row - Hidden by default, shown on hover */}
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-all max-h-0 group-hover:max-h-10 overflow-hidden">
        <div
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
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
