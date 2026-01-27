'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  CheckIcon, 
  PencilIcon, 
  ChevronDownIcon, 
  ChevronUpIcon,
  UserPlusIcon,
  XMarkIcon,
  TagIcon,
  InformationCircleIcon,
  PaintBrushIcon,
  UserGroupIcon,
  PresentationChartLineIcon,
  InboxIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useMapMembership } from '../hooks/useMapMembership';
import toast from 'react-hot-toast';
import SidebarHeader from '@/components/layout/SidebarHeader';
import EmojiPicker from './EmojiPicker';
import { MapPinIcon, Square3Stack3DIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import type { MapSettings, MapMember, MapMembershipRequest, MapCategory, MapBoundary, BoundaryData } from '@/types/map';
import { useBillingEntitlementsSafe } from '@/contexts/BillingEntitlementsContext';
import type { BillingPlan } from '@/lib/billing/types';

type BoundaryLayerKey = 'congressional_districts' | 'ctu_boundaries' | 'state_boundary' | 'county_boundaries';

interface MapSettingsSidebarProps {
  initialMap: {
    id: string;
    account_id: string;
    name: string;
    description: string | null;
    slug: string;
    visibility: 'public' | 'private';
    settings: MapSettings;
    boundary?: MapBoundary;
    boundary_data?: BoundaryData | null;
    auto_approve_members: boolean;
    membership_rules: string | null;
    membership_questions: Array<{ id: number; question: string }>;
    tags?: Array<{ emoji: string; text: string }> | null;
    created_at: string;
    updated_at: string;
  };
  onUpdated?: (updatedMap: any) => void;
  onClose?: () => void;
  isOwner?: boolean;
  userRole?: 'owner' | 'manager' | 'editor' | null;
}

type CollapsibleSection = 'basic' | 'appearance' | 'collaboration' | 'presentation' | 'new-members' | 'requests' | 'categories';

export default function MapSettingsSidebar({ initialMap, onUpdated, onClose, isOwner: propIsOwner, userRole: propUserRole }: MapSettingsSidebarProps) {
  const { account } = useAuthStateSafe();
  const isOwner = propIsOwner ?? (account?.id === initialMap.account_id);
  
  // Use useMapMembership hook to get role (already fetched on page level)
  const { isManager: hookIsManager } = useMapMembership(initialMap.id, initialMap.account_id);
  const canManage = isOwner || hookIsManager;
  
  // Determine user role - use prop if provided, otherwise check from hook
  const effectiveUserRole = propUserRole || (isOwner ? 'owner' : (hookIsManager ? 'manager' : 'editor'));
  
  // Check if user is a member (has any role)
  const isMember = isOwner || hookIsManager || effectiveUserRole === 'editor';

  // Collapsible sections state - all start closed
  const [openSections, setOpenSections] = useState<Set<CollapsibleSection>>(
    new Set()
  );

  const toggleSection = (section: CollapsibleSection) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Get initial emoji from settings.presentation.emoji or null
  const initialEmoji = (initialMap.settings?.presentation as any)?.emoji || null;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // Form state - using new structure
  const [formData, setFormData] = useState({
    name: initialMap.name,
    description: initialMap.description || '',
    slug: initialMap.slug,
    visibility: initialMap.visibility,
    emoji: initialEmoji,
    boundary: (initialMap.boundary || 'statewide') as MapBoundary,
    boundary_data: initialMap.boundary_data || null,
    settings: {
      appearance: {
        map_style: initialMap.settings?.appearance?.map_style || 'street',
        map_layers: initialMap.settings?.appearance?.map_layers || {},
        meta: initialMap.settings?.appearance?.meta || {},
        map_filters: initialMap.settings?.appearance?.map_filters || {
          angle: 0,
          map_styles: false,
          global_layers: false,
        },
      },
      collaboration: {
        allow_pins: initialMap.settings?.collaboration?.allow_pins || false,
        allow_areas: initialMap.settings?.collaboration?.allow_areas || false,
        allow_posts: initialMap.settings?.collaboration?.allow_posts || false,
        allow_clicks: initialMap.settings?.collaboration?.allow_clicks || false,
        pin_permissions: initialMap.settings?.collaboration?.pin_permissions || { required_plan: null },
        area_permissions: initialMap.settings?.collaboration?.area_permissions || { required_plan: null },
        post_permissions: initialMap.settings?.collaboration?.post_permissions || { required_plan: null },
        click_permissions: initialMap.settings?.collaboration?.click_permissions || { required_plan: null },
      },
      presentation: {
        hide_creator: initialMap.settings?.presentation?.hide_creator || false,
        is_featured: initialMap.settings?.presentation?.is_featured || false,
        emoji: initialEmoji,
        show_map_filters_icon: initialMap.settings?.presentation?.show_map_filters_icon ?? true,
      },
      membership: {
        max_members: initialMap.settings?.membership?.max_members ?? null,
      },
    },
    auto_approve_members: initialMap.auto_approve_members,
    membership_rules: initialMap.membership_rules || '',
    membership_questions: initialMap.membership_questions || [],
  });

  // Boundary selection state
  const [counties, setCounties] = useState<Array<{ id: string; county_name: string }>>([]);
  const [cities, setCities] = useState<Array<{ id: string; feature_name: string; ctu_class: string }>>([]);
  const [districts, setDistricts] = useState<Array<{ district_number: number; district_name?: string }>>([]);
  const [loadingBoundaries, setLoadingBoundaries] = useState(false);

  // Requests and categories state (members are handled by MemberManager component)
  const [membershipRequests, setMembershipRequests] = useState<MapMembershipRequest[]>([]);
  const [categories, setCategories] = useState<MapCategory[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  
  // Editing state - must be declared before useEffects that use it
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Debug info: Billing features and plan comparison
  const { features: userFeatures, isLoading: featuresLoading, hasFeature, getFeature } = useBillingEntitlementsSafe();
  const [allPlans, setAllPlans] = useState<Array<BillingPlan & { features?: any[] }>>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  
  // Fetch all plans for comparison
  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        const response = await fetch('/api/billing/plans');
        if (response.ok) {
          const data = await response.json();
          setAllPlans(data.plans || []);
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
      } finally {
        setLoadingPlans(false);
      }
    };
    
    if (showDebugInfo) {
      fetchPlans();
    }
  }, [showDebugInfo]);
  
  // Get current plan info
  const currentPlan = account?.plan || 'hobby';
  const currentPlanData = allPlans.find(p => p.slug === currentPlan);
  const higherPlans = allPlans.filter(p => {
    const planOrder: Record<string, number> = { hobby: 1, contributor: 2, professional: 3, business: 4 };
    return planOrder[p.slug] > (planOrder[currentPlan] || 0);
  });
  
  // Get features user would get with higher plans
  const getNewFeaturesForPlan = (planSlug: string) => {
    const plan = allPlans.find(p => p.slug === planSlug);
    if (!plan || !plan.features) return [];
    
    const currentFeatureSlugs = new Set(userFeatures.map(f => f.slug));
    return plan.features.filter((f: any) => !currentFeatureSlugs.has(f.slug));
  };

  // Fetch members, requests, and categories - only when sidebar opens or auto_approve changes
  // NOTE: Members are NOT fetched here - they're fetched by MemberManager when members sidebar opens
  // This only fetches requests and categories for the settings sidebar
  useEffect(() => {
    if (!canManage) return;

    let cancelled = false;

    const fetchData = async () => {
      // Skip members fetch - MemberManager handles that
      // Only fetch membership requests (if not auto-approve) - use initial value, not formData

      // Fetch membership requests (if not auto-approve) - use initial value, not formData
      if (!initialMap.auto_approve_members) {
        setLoadingRequests(true);
        try {
          const response = await fetch(`/api/maps/${initialMap.id}/membership-requests`);
          if (cancelled) return;
          
          if (response.ok) {
            const data = await response.json();
            setMembershipRequests(data.requests || []);
          }
        } catch (err) {
          if (!cancelled) {
            console.error('Error fetching requests:', err);
          }
        } finally {
          if (!cancelled) {
            setLoadingRequests(false);
          }
        }
      }

      // Fetch categories
      setLoadingCategories(true);
      try {
        const response = await fetch(`/api/maps/${initialMap.id}/categories`);
        if (cancelled) return;
        
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching categories:', err);
        }
      } finally {
        if (!cancelled) {
          setLoadingCategories(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [initialMap.id, canManage, initialMap.auto_approve_members]);

  // Fetch boundary options when boundary type changes
  useEffect(() => {
    if (!isEditing) return;

    let cancelled = false;

    const fetchBoundaries = async () => {
      setLoadingBoundaries(true);
      try {
        if (formData.boundary === 'county') {
          const response = await fetch('/api/civic/county-boundaries?limit=100');
          if (cancelled) return;
          if (response.ok) {
            const data = await response.json();
            setCounties(Array.isArray(data) ? data : []);
          }
        } else if (formData.boundary === 'city' || formData.boundary === 'town') {
          const ctuClass = formData.boundary === 'city' ? 'CITY' : 'TOWNSHIP';
          const response = await fetch(`/api/civic/ctu-boundaries?ctu_class=${ctuClass}&limit=500`);
          if (cancelled) return;
          if (response.ok) {
            const data = await response.json();
            setCities(Array.isArray(data) ? data : []);
          }
        } else if (formData.boundary === 'district') {
          const response = await fetch('/api/civic/congressional-districts');
          if (cancelled) return;
          if (response.ok) {
            const data = await response.json();
            setDistricts(Array.isArray(data) ? data : []);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching boundaries:', err);
        }
      } finally {
        if (!cancelled) {
          setLoadingBoundaries(false);
        }
      }
    };

    if (formData.boundary !== 'statewide') {
      fetchBoundaries();
    } else {
      setCounties([]);
      setCities([]);
      setDistricts([]);
      setLoadingBoundaries(false);
    }

    return () => {
      cancelled = true;
    };
  }, [formData.boundary, isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setFormData({
      name: initialMap.name,
      description: initialMap.description || '',
      slug: initialMap.slug,
      visibility: initialMap.visibility,
      emoji: initialEmoji,
      boundary: (initialMap.boundary || 'statewide') as MapBoundary,
      boundary_data: initialMap.boundary_data || null,
      settings: {
        appearance: {
          map_style: initialMap.settings?.appearance?.map_style || 'street',
          map_layers: initialMap.settings?.appearance?.map_layers || {},
          meta: initialMap.settings?.appearance?.meta || {},
          map_filters: initialMap.settings?.appearance?.map_filters || {},
        },
        collaboration: {
          allow_pins: initialMap.settings?.collaboration?.allow_pins || false,
          allow_areas: initialMap.settings?.collaboration?.allow_areas || false,
          allow_posts: initialMap.settings?.collaboration?.allow_posts || false,
          allow_clicks: initialMap.settings?.collaboration?.allow_clicks || false,
          pin_permissions: initialMap.settings?.collaboration?.pin_permissions || { required_plan: null },
          area_permissions: initialMap.settings?.collaboration?.area_permissions || { required_plan: null },
          post_permissions: initialMap.settings?.collaboration?.post_permissions || { required_plan: null },
          click_permissions: initialMap.settings?.collaboration?.click_permissions || { required_plan: null },
        },
        presentation: {
          hide_creator: initialMap.settings?.presentation?.hide_creator || false,
          is_featured: initialMap.settings?.presentation?.is_featured || false,
          emoji: initialEmoji,
          show_map_filters_icon: initialMap.settings?.presentation?.show_map_filters_icon ?? false,
        },
        membership: {
          max_members: initialMap.settings?.membership?.max_members ?? null,
        },
      },
      auto_approve_members: initialMap.auto_approve_members,
      membership_rules: initialMap.membership_rules || '',
      membership_questions: initialMap.membership_questions || [],
    });
    setIsEditing(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/maps/${initialMap.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          visibility: formData.visibility,
          slug: formData.slug?.trim() || null,
          boundary: formData.boundary,
          boundary_data: formData.boundary_data,
          settings: {
            ...formData.settings,
            presentation: {
              ...formData.settings.presentation,
              emoji: formData.emoji || null,
            },
          },
          auto_approve_members: formData.auto_approve_members,
          membership_rules: formData.membership_rules || null,
          membership_questions: formData.membership_questions,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update map';
        try {
          const data = await response.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const updatedMap = data.map || data;

      setIsEditing(false);
      setIsSaving(false);
      toast.success('Map settings saved', {
        duration: 3000,
      });
      if (onUpdated) {
        onUpdated(updatedMap);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update map';
      setError(errorMessage);
      setIsSaving(false);
      toast.error(errorMessage, {
        duration: 4000,
      });
    }
  };

  // Helper to get selected boundary layer
  const getSelectedBoundaryLayer = (): BoundaryLayerKey | null => {
    const layers = formData.settings.appearance.map_layers || {};
    if (layers.congressional_districts) return 'congressional_districts';
    if (layers.ctu_boundaries) return 'ctu_boundaries';
    if (layers.state_boundary) return 'state_boundary';
    if (layers.county_boundaries) return 'county_boundaries';
    return null;
  };

  const setBoundaryLayer = (layer: BoundaryLayerKey | null) => {
    setFormData({
      ...formData,
      settings: {
        ...formData.settings,
        appearance: {
          ...formData.settings.appearance,
          map_layers: {
            congressional_districts: layer === 'congressional_districts',
            ctu_boundaries: layer === 'ctu_boundaries',
            state_boundary: layer === 'state_boundary',
            county_boundaries: layer === 'county_boundaries',
          },
        },
      },
    });
  };

  // Member management is handled by MemberManager component - no handlers needed here

  const handleApproveRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/maps/${initialMap.id}/membership-requests/${requestId}`, {
        method: 'PUT',
      });
      if (response.ok) {
        setMembershipRequests(prev => prev.filter(r => r.id !== requestId));
        toast.success('Membership request approved', {
          duration: 3000,
        });
        // Members are managed by MemberManager component
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve request');
      }
    } catch (err: any) {
        toast.error(err.message || 'Failed to approve request', {
          duration: 4000,
        });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/maps/${initialMap.id}/membership-requests/${requestId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setMembershipRequests(prev => prev.filter(r => r.id !== requestId));
        toast.success('Membership request rejected', {
          duration: 3000,
        });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject request');
      }
    } catch (err: any) {
        toast.error(err.message || 'Failed to reject request', {
          duration: 4000,
        });
    }
  };

  const handleAddCategory = async (category: MapCategory) => {
    try {
      const response = await fetch(`/api/maps/${initialMap.id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(prev => [...prev, category]);
        toast.success('Category added', {
          duration: 3000,
        });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add category');
      }
    } catch (err: any) {
        toast.error(err.message || 'Failed to add category', {
          duration: 4000,
        });
    }
  };

  const handleRemoveCategory = async (category: MapCategory) => {
    try {
      const response = await fetch(`/api/maps/${initialMap.id}/categories?category=${category}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setCategories(prev => prev.filter(c => c !== category));
        toast.success('Category removed', {
          duration: 3000,
        });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove category');
      }
    } catch (err: any) {
        toast.error(err.message || 'Failed to remove category', {
          duration: 4000,
        });
    }
  };

  // Get collaboration permissions
  const allowPins = initialMap.settings?.collaboration?.allow_pins || false;
  const allowAreas = initialMap.settings?.collaboration?.allow_areas || false;
  const allowPosts = initialMap.settings?.collaboration?.allow_posts || false;
  const allowClicks = initialMap.settings?.collaboration?.allow_clicks || false;

  return (
    <div className="h-full flex flex-col">
      <SidebarHeader
        title="Map Settings"
        onClose={() => {
          if (isEditing) {
            handleCancel();
          }
          if (onClose) {
            onClose();
          }
        }}
        isOwner={isOwner}
        mapId={initialMap.id}
        mapName={initialMap.name}
        onEdit={canManage && !isEditing ? handleEdit : undefined}
        isEditing={isEditing}
        isSaving={isSaving}
        onSave={isEditing ? () => {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        } : undefined}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hide bg-gray-50">
        {!isMember ? (
          // Not a member - show join prompt
          <div className="space-y-3">
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              <p className="text-xs text-gray-600 text-center">
                Join this map to view settings and permissions
              </p>
            </div>
          </div>
        ) : !canManage ? (
          // Member but not owner/manager - show permissions list
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-gray-500">Your Permissions</div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-2">
                {allowPins && (
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <MapPinIcon className="w-3.5 h-3.5 text-gray-500" />
                    <span>Add pins to the map</span>
                  </div>
                )}
                {allowAreas && (
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <Square3Stack3DIcon className="w-3.5 h-3.5 text-gray-500" />
                    <span>Draw areas on the map</span>
                  </div>
                )}
                {allowPosts && (
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <DocumentTextIcon className="w-3.5 h-3.5 text-gray-500" />
                    <span>Create posts</span>
                  </div>
                )}
                {allowClicks && (
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <MapPinIcon className="w-3.5 h-3.5 text-gray-500" />
                    <span>Click on map</span>
                  </div>
                )}
                {!allowPins && !allowAreas && !allowPosts && !allowClicks && (
                  <div className="text-xs text-gray-500">
                    No collaboration permissions enabled
                  </div>
                )}
              </div>
            </div>
            
            {/* Map Info (Read-only) */}
            <div className="border border-gray-200 rounded-md bg-white">
              <div className="px-3 py-2 border-b border-gray-200">
                <div className="text-xs font-semibold text-gray-900">Map Information</div>
              </div>
              <div className="px-3 py-2 space-y-2">
                <div>
                  <div className="text-[10px] font-medium text-gray-500 mb-0.5">Name</div>
                  <div className="text-xs text-gray-900">{initialMap.name}</div>
                </div>
                {initialMap.description && (
                  <div>
                    <div className="text-[10px] font-medium text-gray-500 mb-0.5">Description</div>
                    <div className="text-xs text-gray-600">{initialMap.description}</div>
                  </div>
                )}
                <div>
                  <div className="text-[10px] font-medium text-gray-500 mb-0.5">Visibility</div>
                  <div className="text-xs text-gray-900 capitalize">{initialMap.visibility}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Owner/Manager - show editable form
          <form onSubmit={handleSubmit} className="space-y-2">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-[10px]">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
            

          {/* BASIC INFO SECTION */}
          <div className="border border-gray-200 rounded-md bg-white">
            <button
              type="button"
              onClick={() => toggleSection('basic')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <InformationCircleIcon className="w-4 h-4 text-gray-500" />
                <span>Basic Info</span>
              </div>
              {openSections.has('basic') ? (
                <ChevronUpIcon className="w-3 h-3" />
              ) : (
                <ChevronDownIcon className="w-3 h-3" />
              )}
            </button>
            {openSections.has('basic') && (
              <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2">
                {/* Icon/Emoji */}
                {isOwner && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-0.5">
                      Icon
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        ref={emojiButtonRef}
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        disabled={!isEditing || isSaving}
                        className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed flex items-center justify-center min-h-[40px]"
                      >
                        <span className="text-2xl">{formData.emoji || '📍'}</span>
                      </button>
                      {showEmojiPicker && (
                        <EmojiPicker
                          isOpen={showEmojiPicker}
                          onClose={() => setShowEmojiPicker(false)}
                          onSelect={(emoji) => {
                            setFormData({
                              ...formData,
                              emoji,
                              settings: {
                                ...formData.settings,
                                presentation: {
                                  ...formData.settings.presentation,
                                  emoji,
                                },
                              },
                            });
                            setShowEmojiPicker(false);
                          }}
                          triggerRef={emojiButtonRef as React.RefObject<HTMLElement>}
                        />
                      )}
                      {formData.emoji && isEditing && !isSaving && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              emoji: null,
                              settings: {
                                ...formData.settings,
                                presentation: {
                                  ...formData.settings.presentation,
                                  emoji: null,
                                },
                              },
                            });
                          }}
                          className="absolute top-1 right-1 p-0.5 text-gray-400 hover:text-gray-600 rounded"
                          aria-label="Remove emoji"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-gray-500 mb-0.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
                    placeholder="Map name"
                    disabled={!isEditing || isSaving}
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-xs font-medium text-gray-500 mb-0.5">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                    placeholder="Map description (optional)"
                    rows={3}
                    disabled={!isEditing || isSaving}
                  />
                </div>

                {/* Visibility */}
                <div>
                  <label htmlFor="visibility" className="block text-xs font-medium text-gray-500 mb-0.5">
                    Visibility
                  </label>
                  <select
                    id="visibility"
                    value={formData.visibility}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        visibility: e.target.value as 'public' | 'private',
                      })
                    }
                    className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                    disabled={!isEditing || isSaving}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                {/* Slug */}
                <div>
                  <label htmlFor="slug" className="block text-xs font-medium text-gray-500 mb-0.5">
                    Custom URL slug
                  </label>
                  <input
                    id="slug"
                    type="text"
                    value={formData.slug}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                      setFormData({ ...formData, slug: value });
                    }}
                    className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
                    placeholder="my-custom-map"
                    disabled={!isEditing || isSaving}
                    pattern="[a-z0-9-]+"
                    minLength={3}
                    maxLength={100}
                  />
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Use a custom URL like /map/my-custom-map
                  </p>
                </div>

                {/* Boundary */}
                <div>
                  <label htmlFor="boundary" className="block text-xs font-medium text-gray-500 mb-0.5">
                    Geographic Boundary
                  </label>
                  <select
                    id="boundary"
                    value={formData.boundary}
                    onChange={(e) => {
                      const newBoundary = e.target.value as MapBoundary;
                      setFormData({
                        ...formData,
                        boundary: newBoundary,
                        boundary_data: newBoundary === 'statewide' ? null : formData.boundary_data,
                      });
                    }}
                    className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                    disabled={!isEditing || isSaving}
                  >
                    <option value="statewide">Statewide</option>
                    <option value="county">County</option>
                    <option value="city">City</option>
                    <option value="town">Town</option>
                    <option value="district">District</option>
                  </select>
                </div>

                {/* Boundary Data Selection */}
                {formData.boundary !== 'statewide' && (
                  <div>
                    <label htmlFor="boundary_data" className="block text-xs font-medium text-gray-500 mb-0.5">
                      {formData.boundary === 'county' && 'Select County'}
                      {formData.boundary === 'city' && 'Select City'}
                      {formData.boundary === 'town' && 'Select Town'}
                      {formData.boundary === 'district' && 'Select District'}
                    </label>
                    {loadingBoundaries ? (
                      <div className="text-xs text-gray-500 py-2">Loading...</div>
                    ) : (
                      <select
                        id="boundary_data"
                        value={
                          formData.boundary === 'county'
                            ? formData.boundary_data?.county_id || ''
                            : formData.boundary === 'city' || formData.boundary === 'town'
                            ? formData.boundary_data?.ctu_id || ''
                            : formData.boundary === 'district'
                            ? formData.boundary_data?.district_number?.toString() || ''
                            : ''
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          let newBoundaryData: BoundaryData | null = null;

                          if (formData.boundary === 'county') {
                            const county = counties.find((c) => c.id === value);
                            if (county) {
                              newBoundaryData = {
                                county_id: county.id,
                                county_name: county.county_name,
                              };
                            }
                          } else if (formData.boundary === 'city' || formData.boundary === 'town') {
                            const ctu = cities.find((c) => c.id === value);
                            if (ctu) {
                              newBoundaryData = {
                                ctu_id: ctu.id,
                                city_name: ctu.feature_name,
                                ctu_class: ctu.ctu_class as 'CITY' | 'TOWNSHIP' | 'UNORGANIZED TERRITORY',
                              };
                            }
                          } else if (formData.boundary === 'district') {
                            const district = districts.find((d) => d.district_number.toString() === value);
                            if (district) {
                              newBoundaryData = {
                                district_number: district.district_number,
                                district_name: district.district_name,
                              };
                            }
                          }

                          setFormData({
                            ...formData,
                            boundary_data: newBoundaryData,
                          });
                        }}
                        className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                        disabled={!isEditing || isSaving}
                      >
                        <option value="">Select {formData.boundary}...</option>
                        {formData.boundary === 'county' &&
                          counties.map((county) => (
                            <option key={county.id} value={county.id}>
                              {county.county_name}
                            </option>
                          ))}
                        {(formData.boundary === 'city' || formData.boundary === 'town') &&
                          cities
                            .filter((c) => (formData.boundary === 'city' ? c.ctu_class === 'CITY' : c.ctu_class === 'TOWNSHIP'))
                            .map((city) => (
                              <option key={city.id} value={city.id}>
                                {city.feature_name}
                              </option>
                            ))}
                        {formData.boundary === 'district' &&
                          districts.map((district) => (
                            <option key={district.district_number} value={district.district_number.toString()}>
                              {district.district_name || `District ${district.district_number}`}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* APPEARANCE SECTION */}
          <div className="border border-gray-200 rounded-md bg-white">
            <button
              type="button"
              onClick={() => toggleSection('appearance')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <PaintBrushIcon className="w-4 h-4 text-gray-500" />
                <span>Appearance</span>
              </div>
              {openSections.has('appearance') ? (
                <ChevronUpIcon className="w-3 h-3" />
              ) : (
                <ChevronDownIcon className="w-3 h-3" />
              )}
            </button>
            {openSections.has('appearance') && (
              <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2">
                {/* Map Style */}
                <div>
                  <label htmlFor="map_style" className="block text-xs font-medium text-gray-500 mb-0.5">
                    Map style
                  </label>
                  <select
                    id="map_style"
                    value={formData.settings.appearance.map_style}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          appearance: {
                            ...formData.settings.appearance,
                            map_style: e.target.value as 'street' | 'satellite' | 'light' | 'dark',
                          },
                        },
                      })
                    }
                    className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                    disabled={!isEditing || isSaving}
                  >
                    <option value="street">Street</option>
                    <option value="satellite">Satellite</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>

                {/* Default Boundary Layer */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-0.5">
                    Default boundary layer
                  </label>
                  <div className="space-y-1">
                    {([
                      { id: 'none', label: 'None' },
                      { id: 'congressional_districts', label: 'Congressional districts' },
                      { id: 'ctu_boundaries', label: 'CTU boundaries' },
                      { id: 'county_boundaries', label: 'County boundaries' },
                      { id: 'state_boundary', label: 'State boundary' },
                    ] as const).map((opt) => {
                      const selected = getSelectedBoundaryLayer();
                      const isChecked = opt.id === 'none' ? selected === null : selected === opt.id;
                      return (
                        <label
                          key={opt.id}
                          className="flex items-center justify-between gap-2 text-xs text-gray-700"
                        >
                          <span className="text-xs text-gray-600">{opt.label}</span>
                          <input
                            type="radio"
                            name="default-boundary-layer"
                            checked={isChecked}
                            onChange={() => {
                              setBoundaryLayer(opt.id === 'none' ? null : (opt.id as BoundaryLayerKey));
                            }}
                            className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                            disabled={!isEditing || isSaving}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 3D Buildings */}
                <div className="flex items-center justify-between">
                  <label htmlFor="buildingsEnabled" className="text-xs text-gray-600">
                    Enable 3D buildings
                  </label>
                  <input
                    id="buildingsEnabled"
                    type="checkbox"
                    checked={formData.settings.appearance.meta?.buildingsEnabled || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          appearance: {
                            ...formData.settings.appearance,
                            meta: {
                              ...formData.settings.appearance.meta,
                              buildingsEnabled: e.target.checked,
                            },
                          },
                        },
                      })
                    }
                    className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    disabled={!isEditing || isSaving}
                  />
                </div>

                {/* Pitch */}
                <div>
                  <label htmlFor="pitch" className="block text-xs font-medium text-gray-600 mb-0.5">
                    Pitch (0–60°)
                  </label>
                  <input
                    id="pitch"
                    type="number"
                    min={0}
                    max={60}
                    value={formData.settings.appearance.meta?.pitch ?? 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          appearance: {
                            ...formData.settings.appearance,
                            meta: {
                              ...formData.settings.appearance.meta,
                              pitch: Number(e.target.value),
                            },
                          },
                        },
                      })
                    }
                    className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
                    disabled={!isEditing || isSaving}
                  />
                </div>

                {/* Terrain */}
                <div className="flex items-center justify-between">
                  <label htmlFor="terrainEnabled" className="text-xs text-gray-600">
                    Enable terrain
                  </label>
                  <input
                    id="terrainEnabled"
                    type="checkbox"
                    checked={formData.settings.appearance.meta?.terrainEnabled || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          appearance: {
                            ...formData.settings.appearance,
                            meta: {
                              ...formData.settings.appearance.meta,
                              terrainEnabled: e.target.checked,
                            },
                          },
                        },
                      })
                    }
                    className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    disabled={!isEditing || isSaving}
                  />
                </div>

                {/* Map Filters */}
                <div className="border-t border-gray-200 pt-2 mt-2 space-y-2">
                  <label className="block text-xs font-medium text-gray-900 mb-1">
                    Map Filters
                  </label>
                  
                  {/* Angle */}
                  <div>
                    <label htmlFor="filter_angle" className="block text-xs font-medium text-gray-500 mb-0.5">
                      Angle (0–60°)
                    </label>
                    <input
                      id="filter_angle"
                      type="number"
                      min={0}
                      max={60}
                      value={formData.settings.appearance.map_filters?.angle ?? 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            appearance: {
                              ...formData.settings.appearance,
                              map_filters: {
                                ...formData.settings.appearance.map_filters,
                                angle: Number(e.target.value),
                              },
                            },
                          },
                        })
                      }
                      className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
                      disabled={!isEditing || isSaving}
                    />
                  </div>

                  {/* Map Styles */}
                  <div className="flex items-center justify-between">
                    <label htmlFor="filter_map_styles" className="text-xs text-gray-600">
                      Map styles
                    </label>
                    <input
                      id="filter_map_styles"
                      type="checkbox"
                      checked={formData.settings.appearance.map_filters?.map_styles || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            appearance: {
                              ...formData.settings.appearance,
                              map_filters: {
                                ...formData.settings.appearance.map_filters,
                                map_styles: e.target.checked,
                              },
                            },
                          },
                        })
                      }
                      className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                      disabled={!isEditing || isSaving}
                    />
                  </div>

                  {/* Global Layers */}
                  <div className="flex items-center justify-between">
                    <label htmlFor="filter_global_layers" className="text-xs text-gray-600">
                      Global layers
                    </label>
                    <input
                      id="filter_global_layers"
                      type="checkbox"
                      checked={formData.settings.appearance.map_filters?.global_layers || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            appearance: {
                              ...formData.settings.appearance,
                              map_filters: {
                                ...formData.settings.appearance.map_filters,
                                global_layers: e.target.checked,
                              },
                            },
                          },
                        })
                      }
                      className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COLLABORATION SECTION */}
          <div className="border border-gray-200 rounded-md bg-white">
            <button
              type="button"
              onClick={() => toggleSection('collaboration')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <UserGroupIcon className="w-4 h-4 text-gray-500" />
                <span>Collaboration</span>
              </div>
              {openSections.has('collaboration') ? (
                <ChevronUpIcon className="w-3 h-3" />
              ) : (
                <ChevronDownIcon className="w-3 h-3" />
              )}
            </button>
            {openSections.has('collaboration') && (
              <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2">
                {/* Max Members */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="max_members" className="block text-xs font-medium text-gray-500">
                      Maximum members
                    </label>
                    <span className="text-xs font-semibold text-gray-900">
                      {formData.settings.membership?.max_members ?? 'No limit'}
                    </span>
                  </div>
                  {(() => {
                    const planLimit = hasFeature('map_members') ? getFeature('map_members') : null;
                    const maxLimit = planLimit?.is_unlimited 
                      ? 1000 // Cap at 1000 for unlimited plans
                      : planLimit?.limit_value ?? 100; // Default to 100 if no plan limit
                    const minLimit = 1;
                    const defaultLimit = 50; // Default to 50 (lowest maximum for all plans)
                    const hasLimit = formData.settings.membership?.max_members !== null && formData.settings.membership?.max_members !== undefined;
                    const currentValue = hasLimit ? formData.settings.membership!.max_members! : defaultLimit;
                    
                    return (
                      <>
                        {hasLimit ? (
                          <>
                            <input
                              id="max_members"
                              type="range"
                              min={minLimit}
                              max={maxLimit}
                              step={1}
                              value={currentValue}
                              onChange={(e) => {
                                const value = parseInt(e.target.value, 10);
                                setFormData({
                                  ...formData,
                                  settings: {
                                    ...formData.settings,
                                    membership: {
                                      ...formData.settings.membership,
                                      max_members: value > 0 ? value : null,
                                    },
                                  },
                                });
                              }}
                              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gray-900 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-gray-900 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                              style={{
                                background: `linear-gradient(to right, #111827 0%, #111827 ${((currentValue - minLimit) / (maxLimit - minLimit)) * 100}%, #e5e7eb ${((currentValue - minLimit) / (maxLimit - minLimit)) * 100}%, #e5e7eb 100%)`
                              }}
                              disabled={!isEditing || isSaving}
                            />
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[10px] text-gray-400">{minLimit}</span>
                              <p className="text-[11px] text-gray-500 text-center">
                                {planLimit?.is_unlimited 
                                  ? 'Unlimited (slider capped at 1000)'
                                  : planLimit?.limit_value 
                                  ? `Plan limit: ${planLimit.limit_value}`
                                  : 'No plan limit'}
                              </p>
                              <span className="text-[10px] text-gray-400">{maxLimit}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  settings: {
                                    ...formData.settings,
                                    membership: {
                                      ...formData.settings.membership,
                                      max_members: null,
                                    },
                                  },
                                });
                              }}
                              className="mt-1 text-[11px] text-gray-500 hover:text-gray-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={!isEditing || isSaving}
                            >
                              Remove limit
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                settings: {
                                  ...formData.settings,
                                  membership: {
                                    ...formData.settings.membership,
                                    max_members: Math.min(defaultLimit, maxLimit), // Default to 50, but cap at plan limit
                                  },
                                },
                              });
                            }}
                            className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!isEditing || isSaving}
                          >
                            Set member limit (defaults to {Math.min(defaultLimit, maxLimit)})
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Membership Rules */}
                <div>
                  <label htmlFor="membership_rules" className="block text-xs font-medium text-gray-500 mb-0.5">
                    Membership rules/terms
                  </label>
                  <textarea
                    id="membership_rules"
                    value={formData.membership_rules}
                    onChange={(e) => setFormData({ ...formData, membership_rules: e.target.value })}
                    className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                    placeholder="Custom rules or terms for membership (optional)"
                    rows={3}
                    disabled={!isEditing || isSaving}
                  />
                </div>

                {/* Collaboration Settings - Always visible, but disabled for private maps */}
                <div className="pt-2 border-t border-gray-200 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-900">
                    {formData.visibility === 'public' ? 'Public collaboration' : 'Collaboration'}
                  </h4>
                  {formData.visibility === 'private' && (
                    <p className="text-[11px] text-gray-500 mb-2">
                      Collaboration settings are only available for public maps
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <label htmlFor="allow_pins" className="text-xs text-gray-600">
                      Allow others to add pins
                    </label>
                    <input
                      id="allow_pins"
                      type="checkbox"
                      checked={formData.settings.collaboration.allow_pins}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            collaboration: {
                              ...formData.settings.collaboration,
                              allow_pins: e.target.checked,
                            },
                          },
                        })
                      }
                      className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                      disabled={!isEditing || isSaving || formData.visibility === 'private'}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="allow_areas" className="text-xs text-gray-600">
                      Allow others to add areas
                    </label>
                    <input
                      id="allow_areas"
                      type="checkbox"
                      checked={formData.settings.collaboration.allow_areas}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            collaboration: {
                              ...formData.settings.collaboration,
                              allow_areas: e.target.checked,
                            },
                          },
                        })
                      }
                      className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                      disabled={!isEditing || isSaving || formData.visibility === 'private'}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="allow_posts" className="text-xs text-gray-600">
                      Allow others to create posts
                    </label>
                    <input
                      id="allow_posts"
                      type="checkbox"
                      checked={formData.settings.collaboration.allow_posts}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            collaboration: {
                              ...formData.settings.collaboration,
                              allow_posts: e.target.checked,
                            },
                          },
                        })
                      }
                      className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                      disabled={!isEditing || isSaving || formData.visibility === 'private'}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="allow_clicks" className="text-xs text-gray-600">
                      Allow others to click on map
                    </label>
                    <input
                      id="allow_clicks"
                      type="checkbox"
                      checked={formData.settings.collaboration.allow_clicks}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            collaboration: {
                              ...formData.settings.collaboration,
                              allow_clicks: e.target.checked,
                            },
                          },
                        })
                      }
                      className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                      disabled={!isEditing || isSaving || formData.visibility === 'private'}
                    />
                  </div>
                      
                  {/* Plan-Based Permissions (NEW) */}
                  {formData.settings.collaboration.allow_pins && (
                    <div className="pt-2 border-t border-gray-200 space-y-1.5">
                      <label className="text-[10px] font-medium text-gray-500">
                        Minimum plan to add pins
                      </label>
                      <select
                        value={formData.settings.collaboration.pin_permissions?.required_plan || 'any'}
                        onChange={(e) => {
                          const value = e.target.value === 'any' ? null : e.target.value;
                          setFormData({
                            ...formData,
                            settings: {
                              ...formData.settings,
                              collaboration: {
                                ...formData.settings.collaboration,
                                pin_permissions: { required_plan: value as any },
                              },
                            },
                          });
                        }}
                        className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                        disabled={!isEditing || isSaving || formData.visibility === 'private'}
                          >
                            <option value="any">Any authenticated user</option>
                            <option value="hobby">Hobby plan or higher</option>
                            <option value="contributor">Contributor plan or higher</option>
                            <option value="professional">Professional plan or higher</option>
                            <option value="business">Business plan only</option>
                          </select>
                        </div>
                      )}
                      
                      {formData.settings.collaboration.allow_areas && (
                        <div className="pt-2 border-t border-gray-200 space-y-1.5">
                          <label className="text-[10px] font-medium text-gray-500">
                            Minimum plan to draw areas
                          </label>
                          <select
                            value={formData.settings.collaboration.area_permissions?.required_plan || 'any'}
                            onChange={(e) => {
                              const value = e.target.value === 'any' ? null : e.target.value;
                              setFormData({
                                ...formData,
                                settings: {
                                  ...formData.settings,
                                  collaboration: {
                                    ...formData.settings.collaboration,
                                    area_permissions: { required_plan: value as any },
                                  },
                                },
                              });
                            }}
                            className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                            disabled={!isEditing || isSaving || formData.visibility === 'private'}
                          >
                            <option value="any">Any authenticated user</option>
                            <option value="hobby">Hobby plan or higher</option>
                            <option value="contributor">Contributor plan or higher</option>
                            <option value="professional">Professional plan or higher</option>
                            <option value="business">Business plan only</option>
                          </select>
                        </div>
                      )}
                      
                      {formData.settings.collaboration.allow_posts && (
                        <div className="pt-2 border-t border-gray-200 space-y-1.5">
                          <label className="text-[10px] font-medium text-gray-500">
                            Minimum plan to create posts
                          </label>
                          <select
                            value={formData.settings.collaboration.post_permissions?.required_plan || 'any'}
                            onChange={(e) => {
                              const value = e.target.value === 'any' ? null : e.target.value;
                              setFormData({
                                ...formData,
                                settings: {
                                  ...formData.settings,
                                  collaboration: {
                                    ...formData.settings.collaboration,
                                    post_permissions: { required_plan: value as any },
                                  },
                                },
                              });
                            }}
                            className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                            disabled={!isEditing || isSaving || formData.visibility === 'private'}
                          >
                            <option value="any">Any authenticated user</option>
                            <option value="hobby">Hobby plan or higher</option>
                            <option value="contributor">Contributor plan or higher</option>
                            <option value="professional">Professional plan or higher</option>
                            <option value="business">Business plan only</option>
                          </select>
                        </div>
                      )}
                    </div>
              </div>
            )}
          </div>

          {/* PRESENTATION SECTION */}
          <div className="border border-gray-200 rounded-md bg-white">
            <button
              type="button"
              onClick={() => toggleSection('presentation')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <PresentationChartLineIcon className="w-4 h-4 text-gray-500" />
                <span>Presentation</span>
              </div>
              {openSections.has('presentation') ? (
                <ChevronUpIcon className="w-3 h-3" />
              ) : (
                <ChevronDownIcon className="w-3 h-3" />
              )}
            </button>
            {openSections.has('presentation') && (
              <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="is_featured" className="text-xs text-gray-600">
                    Featured map
                  </label>
                  <input
                    id="is_featured"
                    type="checkbox"
                    checked={formData.settings.presentation.is_featured}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          presentation: {
                            ...formData.settings.presentation,
                            is_featured: e.target.checked,
                          },
                        },
                      })
                    }
                    className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    disabled={!isEditing || isSaving}
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  Featured maps appear at the top of the community feed
                </p>

                <div className="flex items-center justify-between">
                  <label htmlFor="hide_creator" className="text-xs text-gray-600">
                    Hide creator badge
                  </label>
                  <input
                    id="hide_creator"
                    type="checkbox"
                    checked={formData.settings.presentation.hide_creator}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          presentation: {
                            ...formData.settings.presentation,
                            hide_creator: e.target.checked,
                          },
                        },
                      })
                    }
                    className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    disabled={!isEditing || isSaving}
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  Hide the creator badge on map cards
                </p>

                <div className="flex items-center justify-between">
                  <label htmlFor="show_map_filters_icon" className="text-xs text-gray-600">
                    Show map filters icon
                  </label>
                  <input
                    id="show_map_filters_icon"
                    type="checkbox"
                    checked={formData.settings.presentation.show_map_filters_icon}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          presentation: {
                            ...formData.settings.presentation,
                            show_map_filters_icon: e.target.checked,
                          },
                        },
                      })
                    }
                    className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    disabled={!isEditing || isSaving}
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  Show the map filters icon when any filter is enabled (angle, map styles, or global layers)
                </p>
              </div>
            )}
          </div>

          {/* NEW MEMBERS SECTION */}
          <div className="border border-gray-200 rounded-md bg-white">
            <button
              type="button"
              onClick={() => toggleSection('new-members')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <UserPlusIcon className="w-4 h-4 text-gray-500" />
                <span>New Members</span>
              </div>
              {openSections.has('new-members') ? (
                <ChevronUpIcon className="w-3 h-3" />
              ) : (
                <ChevronDownIcon className="w-3 h-3" />
              )}
            </button>
            {openSections.has('new-members') && (
              <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2">
                {/* Auto Approve Members */}
                <div className="flex items-center justify-between">
                  <label htmlFor="auto_approve_members" className="text-xs text-gray-600">
                    Auto-approve membership requests
                  </label>
                  <input
                    id="auto_approve_members"
                    type="checkbox"
                    checked={formData.auto_approve_members}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        auto_approve_members: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    disabled={!isEditing || isSaving}
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  When enabled, membership requests are automatically approved
                </p>

                {/* Membership Questions */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-0.5">
                    Membership questions (max 5)
                  </label>
                  <div className="space-y-1.5">
                    {formData.membership_questions.map((q, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={q.question}
                          onChange={(e) => {
                            const updated = [...formData.membership_questions];
                            updated[idx] = { ...q, question: e.target.value };
                            setFormData({ ...formData, membership_questions: updated });
                          }}
                          className="flex-1 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 disabled:bg-gray-50"
                          placeholder="Question text"
                          disabled={!isEditing || isSaving}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              membership_questions: formData.membership_questions.filter((_, i) => i !== idx),
                            });
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          disabled={!isEditing || isSaving}
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {formData.membership_questions.length < 5 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            membership_questions: [
                              ...formData.membership_questions,
                              { id: formData.membership_questions.length, question: '' },
                            ],
                          });
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-700"
                        disabled={!isEditing || isSaving}
                      >
                        + Add question
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MEMBERSHIP REQUESTS SECTION */}
          {!formData.auto_approve_members && (
            <div className="border border-gray-200 rounded-md bg-white">
              <button
                type="button"
                onClick={() => toggleSection('requests')}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <InboxIcon className="w-4 h-4 text-gray-500" />
                  <span>Membership Requests ({membershipRequests.length})</span>
                </div>
                {openSections.has('requests') ? (
                  <ChevronUpIcon className="w-3 h-3" />
                ) : (
                  <ChevronDownIcon className="w-3 h-3" />
                )}
              </button>
              {openSections.has('requests') && (
                <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2">
                  {loadingRequests ? (
                    <div className="text-xs text-gray-500">Loading requests...</div>
                  ) : membershipRequests.length === 0 ? (
                    <div className="text-xs text-gray-500">No pending requests</div>
                  ) : (
                    <div className="space-y-1.5">
                      {membershipRequests.map((request) => (
                        <div
                          key={request.id}
                          className="p-2 bg-gray-50 rounded-md space-y-1"
                        >
                          <div className="text-xs font-medium text-gray-900">
                            {request.account?.username ||
                              `${request.account?.first_name || ''} ${request.account?.last_name || ''}`.trim() ||
                              'Unknown'}
                          </div>
                          {request.answers && request.answers.length > 0 && (
                            <div className="text-[11px] text-gray-600 space-y-0.5">
                              {request.answers.map((answer, idx) => (
                                <div key={idx}>
                                  <span className="font-medium">Q{answer.question_id + 1}:</span>{' '}
                                  {answer.answer}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              onClick={() => handleApproveRequest(request.id)}
                              className="flex-1 px-2 py-1 text-[10px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectRequest(request.id)}
                              className="flex-1 px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CATEGORIES SECTION */}
          <div className="border border-gray-200 rounded-md bg-white">
            <button
              type="button"
              onClick={() => toggleSection('categories')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Squares2X2Icon className="w-4 h-4 text-gray-500" />
                <span>Categories ({categories.length})</span>
              </div>
              {openSections.has('categories') ? (
                <ChevronUpIcon className="w-3 h-3" />
              ) : (
                <ChevronDownIcon className="w-3 h-3" />
              )}
            </button>
            {openSections.has('categories') && (
              <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2">
                {loadingCategories ? (
                  <div className="text-xs text-gray-500">Loading categories...</div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {categories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-700 rounded border border-gray-200"
                        >
                          {cat}
                          <button
                            onClick={() => handleRemoveCategory(cat)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <XMarkIcon className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {(['community', 'professional', 'government', 'atlas', 'user'] as MapCategory[])
                        .filter((cat) => !categories.includes(cat))
                        .map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => handleAddCategory(cat)}
                            className="w-full text-left px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50 rounded"
                          >
                            + {cat}
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          </form>
        )}
        
        {/* Debug Info Section - Shows plan and features */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <button
            type="button"
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors rounded-md"
          >
            <span className="flex items-center gap-1.5">
              <span>🔍 Debug: Plan & Features</span>
              <span className="text-[10px] font-normal text-gray-400">(Dev Only)</span>
            </span>
            {showDebugInfo ? (
              <ChevronUpIcon className="w-3 h-3" />
            ) : (
              <ChevronDownIcon className="w-3 h-3" />
            )}
          </button>
          
          {showDebugInfo && (
            <div className="mt-2 px-3 pb-3 space-y-3">
              {/* Current Plan */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-1.5">
                <div className="text-[10px] font-semibold text-gray-500 uppercase">Current Plan</div>
                <div className="text-xs font-semibold text-gray-900 capitalize">{currentPlan}</div>
                {currentPlanData && (
                  <div className="text-[10px] text-gray-600">
                    ${(currentPlanData.price_monthly_cents / 100).toFixed(2)}/mo
                  </div>
                )}
              </div>
              
              {/* Current Features */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-1.5">
                <div className="text-[10px] font-semibold text-gray-500 uppercase">
                  Your Features ({userFeatures.length})
                </div>
                {featuresLoading ? (
                  <div className="text-xs text-gray-500">Loading features...</div>
                ) : userFeatures.length === 0 ? (
                  <div className="text-xs text-gray-500">No features</div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {userFeatures.map((feature) => (
                      <div key={feature.slug} className="flex items-start gap-1.5 text-xs text-gray-700">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{feature.name}</div>
                          {feature.limit_type && (
                            <div className="text-[10px] text-gray-500">
                              {feature.limit_type === 'unlimited' && '∞ Unlimited'}
                              {feature.limit_type === 'count' && feature.limit_value !== null && `${feature.limit_value} limit`}
                              {feature.limit_type === 'storage_mb' && feature.limit_value !== null && `${feature.limit_value}MB`}
                              {feature.limit_type === 'boolean' && 'Enabled'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Higher Plan Comparisons */}
              {higherPlans.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase">
                    Features with Higher Plans
                  </div>
                  {loadingPlans ? (
                    <div className="text-xs text-gray-500">Loading plans...</div>
                  ) : (
                    <div className="space-y-2">
                      {higherPlans.map((plan) => {
                        const newFeatures = getNewFeaturesForPlan(plan.slug);
                        return (
                          <div key={plan.id} className="bg-blue-50 border border-blue-200 rounded-md p-[10px] space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs font-semibold text-gray-900 capitalize">{plan.name}</div>
                                <div className="text-[10px] text-gray-600">
                                  ${(plan.price_monthly_cents / 100).toFixed(2)}/mo
                                </div>
                              </div>
                              {newFeatures.length > 0 && (
                                <span className="text-[10px] font-semibold text-blue-600">
                                  +{newFeatures.length} new
                                </span>
                              )}
                            </div>
                            {newFeatures.length > 0 ? (
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {newFeatures.slice(0, 10).map((feature: any) => (
                                  <div key={feature.id || feature.slug} className="flex items-center gap-1.5 text-xs text-gray-700">
                                    <span className="text-blue-500">+</span>
                                    <span className="truncate">{feature.name || feature.feature_name}</span>
                                  </div>
                                ))}
                                {newFeatures.length > 10 && (
                                  <div className="text-[10px] text-gray-500">
                                    +{newFeatures.length - 10} more features
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">No additional features</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              
              {/* Map Permission Status */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-1.5">
                <div className="text-[10px] font-semibold text-gray-500 uppercase">
                  Map Permission Status
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Add Pins</span>
                    <span className={`font-medium ${
                      formData.settings.collaboration.allow_pins 
                        ? (formData.settings.collaboration.pin_permissions?.required_plan
                            ? 'text-blue-600' // Plan-based
                            : 'text-red-600') // Owner-granted
                        : 'text-gray-400'
                    }`}>
                      {formData.settings.collaboration.allow_pins
                        ? (formData.settings.collaboration.pin_permissions?.required_plan
                            ? `${formData.settings.collaboration.pin_permissions.required_plan}+`
                            : 'Enabled')
                        : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Draw Areas</span>
                    <span className={`font-medium ${
                      formData.settings.collaboration.allow_areas
                        ? (formData.settings.collaboration.area_permissions?.required_plan
                            ? 'text-blue-600' // Plan-based
                            : 'text-red-600') // Owner-granted
                        : 'text-gray-400'
                    }`}>
                      {formData.settings.collaboration.allow_areas
                        ? (formData.settings.collaboration.area_permissions?.required_plan
                            ? `${formData.settings.collaboration.area_permissions.required_plan}+`
                            : 'Enabled')
                        : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Create Posts</span>
                    <span className={`font-medium ${
                      formData.settings.collaboration.allow_posts
                        ? (formData.settings.collaboration.post_permissions?.required_plan
                            ? 'text-blue-600' // Plan-based
                            : 'text-red-600') // Owner-granted
                        : 'text-gray-400'
                    }`}>
                      {formData.settings.collaboration.allow_posts
                        ? (formData.settings.collaboration.post_permissions?.required_plan
                            ? `${formData.settings.collaboration.post_permissions.required_plan}+`
                            : 'Enabled')
                        : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Click on Map</span>
                    <span className={`font-medium ${
                      formData.settings.collaboration.allow_clicks
                        ? (formData.settings.collaboration.click_permissions?.required_plan
                            ? 'text-blue-600' // Plan-based
                            : 'text-red-600') // Owner-granted
                        : 'text-gray-400'
                    }`}>
                      {formData.settings.collaboration.allow_clicks
                        ? (formData.settings.collaboration.click_permissions?.required_plan
                            ? `${formData.settings.collaboration.click_permissions.required_plan}+`
                            : 'Enabled')
                        : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
