'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
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

interface PlansKanbanViewProps {
  onViewDetails?: (planSlug: string) => void;
  currentPlanSlug?: string;
  showCarousel?: boolean;
  initialPlans?: PlanWithFeatures[];
}

export default function PlansKanbanView({ onViewDetails, currentPlanSlug, showCarousel = true, initialPlans }: PlansKanbanViewProps) {
  const [plans, setPlans] = useState<PlanWithFeatures[]>(initialPlans || []);
  const [loading, setLoading] = useState(!initialPlans);
  const [activePlanIndex, setActivePlanIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only fetch if we don't have initial plans
    if (!initialPlans || initialPlans.length === 0) {
      fetchPlans();
    }
  }, [initialPlans]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/plans');
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
      } else {
        console.error('Failed to fetch plans');
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToPlan = (index: number) => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const cardWidth = 320 + 16; // 80 * 4 = 320px + 16px gap
    const scrollPosition = index * cardWidth;
    
    container.scrollTo({
      left: scrollPosition,
      behavior: 'smooth',
    });
    
    setActivePlanIndex(index);
  };

  const handlePrevPlan = () => {
    if (activePlanIndex > 0) {
      scrollToPlan(activePlanIndex - 1);
    }
  };

  const handleNextPlan = () => {
    if (activePlanIndex < plans.length - 1) {
      scrollToPlan(activePlanIndex + 1);
    }
  };

  // Handle scroll to update active plan index
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const cardWidth = 320 + 16;
      const newIndex = Math.round(scrollLeft / cardWidth);
      
      if (newIndex !== activePlanIndex && newIndex >= 0 && newIndex < plans.length) {
        setActivePlanIndex(newIndex);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activePlanIndex, plans.length]);

  if (loading) {
    return (
      <div className="w-full py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
          <p className="mt-3 text-sm text-gray-500">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Kanban Columns */}
      {showCarousel && (
      <div 
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-4 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {plans.map((plan, index) => {
          const directFeatures = plan.features.filter(f => !f.isInherited);
          const inheritedFeatures = plan.features.filter(f => f.isInherited);
          const priceDisplay = plan.price_monthly_cents === 0 
            ? 'Free' 
            : `$${(plan.price_monthly_cents / 100).toFixed(0)}/mo`;
          const isFeaturedPlan = index === activePlanIndex;
          const isUserActivePlan = currentPlanSlug && plan.slug.toLowerCase() === currentPlanSlug.toLowerCase();
          
          // Border logic: Green for active plan, Gray for featured non-active plans, Light gray for others
          let borderClass = 'border border-gray-200';
          if (isUserActivePlan) {
            borderClass = 'border-2 border-green-500';
          } else if (isFeaturedPlan) {
            borderClass = 'border-2 border-gray-900';
          }

          return (
            <div
              key={plan.id}
              className={`flex flex-col flex-shrink-0 w-80 bg-white rounded-lg overflow-hidden transition-all duration-300 ${borderClass} ${
                !isUserActivePlan ? 'hover:border-2 hover:border-gray-900 hover:shadow-lg' : ''
              }`}
            >
              {/* Plan Header */}
              <div className={`p-4 border-b ${isUserActivePlan ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  {isUserActivePlan && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-green-500 text-white">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{priceDisplay}</div>
                {plan.description && (
                  <p className="text-xs text-gray-600 leading-relaxed">{plan.description}</p>
                )}
              </div>

              {/* Features List */}
              <div className="flex-1 p-4 overflow-y-auto max-h-[500px] space-y-4">
                {/* Main Features (Boolean/No Limit) */}
                <div className="flex flex-wrap gap-2">
                  {directFeatures
                    .filter(f => !f.limit_type || f.limit_type === 'boolean')
                    .map((feature) => (
                      <div
                        key={feature.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-900 hover:bg-gray-50 transition-colors"
                      >
                        {feature.emoji && (
                          <span className="text-sm">{feature.emoji}</span>
                        )}
                        <span>{feature.name}</span>
                        {!feature.is_active && (
                          <span className="text-[10px] text-gray-400 italic">(Soon)</span>
                        )}
                      </div>
                    ))}
                </div>

                {/* Features with Limits */}
                {directFeatures.some(f => f.limit_type && f.limit_type !== 'boolean') && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Limits</div>
                    <div className="flex flex-wrap gap-2">
                      {directFeatures
                        .filter(f => f.limit_type && f.limit_type !== 'boolean')
                        .map((feature) => {
                          let featureLabel = feature.name;
                          if (feature.limit_type === 'unlimited') {
                            featureLabel = `Unlimited ${feature.name}`;
                          } else if (feature.limit_type === 'count' && feature.limit_value !== null) {
                            featureLabel = `${feature.limit_value} ${feature.name}`;
                          } else if (feature.limit_type === 'storage_mb' && feature.limit_value !== null) {
                            featureLabel = `${feature.limit_value}MB ${feature.name}`;
                          }

                          return (
                            <div
                              key={feature.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-full text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              {feature.emoji && (
                                <span className="text-sm">{feature.emoji}</span>
                              )}
                              <span>{featureLabel}</span>
                              {!feature.is_active && (
                                <span className="text-[10px] text-gray-400 italic">(Soon)</span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* View Details Button */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <button
                  onClick={() => onViewDetails?.(plan.slug)}
                  className={`w-full px-4 py-2.5 text-sm font-semibold rounded-md transition-all ${
                    isUserActivePlan
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {isUserActivePlan ? 'Manage Plan' : 'Select Plan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Billing Footer with Navigation */}
      {showCarousel && plans.length > 1 && (
        <div className="flex items-center justify-center gap-8 mt-8 py-4 border-t border-gray-100">
          {/* Left Arrow */}
          <button
            onClick={handlePrevPlan}
            disabled={activePlanIndex === 0}
            className={`w-10 h-10 flex items-center justify-center rounded-full bg-white border-2 transition-all ${
              activePlanIndex === 0
                ? 'border-gray-200 opacity-40 cursor-not-allowed'
                : 'border-gray-300 hover:border-gray-900 hover:bg-gray-50'
            }`}
            aria-label="Previous plan"
          >
            <ChevronLeftIcon className={`w-5 h-5 ${activePlanIndex === 0 ? 'text-gray-400' : 'text-gray-700'}`} />
          </button>

          {/* Pagination Dots */}
          <div className="flex items-center justify-center gap-2.5">
            {plans.map((plan, index) => (
              <button
                key={plan.id}
                onClick={() => scrollToPlan(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  index === activePlanIndex
                    ? 'bg-gray-900'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to ${plan.name} plan`}
              />
            ))}
          </div>

          {/* Right Arrow */}
          <button
            onClick={handleNextPlan}
            disabled={activePlanIndex === plans.length - 1}
            className={`w-10 h-10 flex items-center justify-center rounded-full bg-white border-2 transition-all ${
              activePlanIndex === plans.length - 1
                ? 'border-gray-200 opacity-40 cursor-not-allowed'
                : 'border-gray-300 hover:border-gray-900 hover:bg-gray-50'
            }`}
            aria-label="Next plan"
          >
            <ChevronRightIcon className={`w-5 h-5 ${activePlanIndex === plans.length - 1 ? 'text-gray-400' : 'text-gray-700'}`} />
          </button>
        </div>
      )}

      {/* Plans and Features Comparison Table */}
      {plans.length > 0 && (
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left p-[10px] text-xs font-semibold text-gray-900 sticky left-0 bg-white z-10">
                    Feature
                  </th>
                  {plans.map((plan) => {
                    const priceDisplay = plan.price_monthly_cents === 0 
                      ? 'Free' 
                      : `$${(plan.price_monthly_cents / 100).toFixed(0)}/mo`;
                    const isUserActivePlan = currentPlanSlug && plan.slug.toLowerCase() === currentPlanSlug.toLowerCase();
                    
                    return (
                      <th
                        key={plan.id}
                        className={`text-center p-[10px] text-xs font-semibold text-gray-900 min-w-[120px] ${
                          isUserActivePlan ? 'bg-green-50' : 'bg-gray-50'
                        }`}
                      >
                        <div className="font-bold text-gray-900">{plan.name}</div>
                        <div className="text-[10px] text-gray-600 mt-0.5">{priceDisplay}</div>
                        {isUserActivePlan && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500 text-white">
                              Active
                            </span>
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Get all unique features across all plans
                  const allFeaturesMap = new Map();
                  plans.forEach((plan) => {
                    plan.features.forEach((feature) => {
                      if (!allFeaturesMap.has(feature.id)) {
                        allFeaturesMap.set(feature.id, {
                          ...feature,
                          plans: new Set(),
                        });
                      }
                      allFeaturesMap.get(feature.id).plans.add(plan.id);
                    });
                  });
                  
                  const allFeatures = Array.from(allFeaturesMap.values()).sort((a, b) => {
                    // Sort by category, then name
                    if (a.category !== b.category) {
                      return (a.category || '').localeCompare(b.category || '');
                    }
                    return a.name.localeCompare(b.name);
                  });

                  return allFeatures.map((feature) => (
                    <tr key={feature.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="p-[10px] text-xs text-gray-700 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-1.5">
                          {feature.emoji && <span className="text-sm">{feature.emoji}</span>}
                          <span className="font-medium">{feature.name}</span>
                          {feature.category && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 capitalize">
                              {feature.category}
                            </span>
                          )}
                        </div>
                      </td>
                      {plans.map((plan) => {
                        const planFeature = plan.features.find(f => f.id === feature.id);
                        const hasFeature = !!planFeature;
                        const isUserActivePlan = currentPlanSlug && plan.slug.toLowerCase() === currentPlanSlug.toLowerCase();
                        
                        return (
                          <td
                            key={plan.id}
                            className={`text-center p-[10px] text-xs ${
                              isUserActivePlan ? 'bg-green-50' : ''
                            }`}
                          >
                            {hasFeature ? (
                              <div className="flex flex-col items-center gap-0.5">
                                {planFeature.limit_type === 'boolean' || !planFeature.limit_type ? (
                                  <span className="text-green-500 font-semibold">✓</span>
                                ) : planFeature.limit_type === 'unlimited' ? (
                                  <span className="text-gray-900 font-semibold">∞</span>
                                ) : planFeature.limit_type === 'count' && planFeature.limit_value !== null ? (
                                  <span className="text-gray-900 font-semibold">{planFeature.limit_value}</span>
                                ) : planFeature.limit_type === 'storage_mb' && planFeature.limit_value != null ? (
                                  <span className="text-gray-900 font-semibold text-[10px]">
                                    {planFeature.limit_value >= 1000 
                                      ? `${(planFeature.limit_value / 1000).toFixed(1)}GB`
                                      : `${planFeature.limit_value}MB`}
                                  </span>
                                ) : (
                                  <span className="text-green-500 font-semibold">✓</span>
                                )}
                                {!planFeature.is_active && (
                                  <span className="text-[10px] text-gray-400 italic">Soon</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ));
                })()}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td className="p-[10px] sticky left-0 bg-white z-10"></td>
                  {plans.map((plan) => {
                    const isUserActivePlan = currentPlanSlug && plan.slug.toLowerCase() === currentPlanSlug.toLowerCase();
                    
                    return (
                      <td
                        key={plan.id}
                        className={`text-center p-[10px] ${
                          isUserActivePlan ? 'bg-green-50' : 'bg-gray-50'
                        }`}
                      >
                        <button
                          onClick={() => onViewDetails?.(plan.slug)}
                          className="w-full px-3 py-1.5 text-xs font-semibold rounded-md bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 transition-colors"
                        >
                          View
                        </button>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
