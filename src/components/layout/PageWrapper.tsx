'use client';

import { ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import AccountDropdown from '@/features/auth/components/AccountDropdown';
import ContentTypeFilters from './ContentTypeFilters';
import { usePageView } from '@/hooks/usePageView';
import { useNativeIOSApp } from '@/hooks/useNativeIOSApp';
import { supabase } from '@/lib/supabase';
import { useAuthStateSafe } from '@/features/auth';
import MapsSelectorDropdown from './MapsSelectorDropdown';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { XCircleIcon, EyeIcon, ChatBubbleLeftIcon, UserPlusIcon, MapPinIcon, Square3Stack3DIcon, DocumentTextIcon, GlobeAltIcon, LockClosedIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  HomeIcon, 
  MapIcon, 
  UsersIcon,
  SparklesIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline';
import { 
  HomeIcon as HomeIconSolid, 
  MapIcon as MapIconSolid, 
  UsersIcon as UsersIconSolid,
  SparklesIcon as SparklesIconSolid,
  CreditCardIcon as CreditCardIconSolid
} from '@heroicons/react/24/solid';

interface AccountDropdownProps {
  onAccountClick?: () => void;
  onSignInClick?: () => void;
}

interface PageWrapperProps {
  children: ReactNode;
  headerContent?: ReactNode;
  searchComponent?: ReactNode;
  showAccountDropdown?: boolean;
  accountDropdownProps?: AccountDropdownProps;
  searchResultsComponent?: ReactNode;
  className?: string;
  /** Enable automatic page view tracking. Default: true */
  trackPageView?: boolean;
  /** View As role - when provided, gradient only shows if role is 'owner' */
  viewAsRole?: 'owner' | 'manager' | 'editor' | 'non-member';
  /** Map settings - used to get role-based colors */
  mapSettings?: {
    colors?: {
      owner?: string;
      manager?: string;
      editor?: string;
      'non-member'?: string;
    };
  } | null;
  /** Initial auth data from server (optional - avoids blocking) */
  initialAuth?: {
    userId: string | null;
    accountId: string | null;
    role: 'general' | 'admin' | null;
    name: string | null;
  } | null;
  /** Initial billing data from server (optional - avoids blocking) */
  initialBilling?: {
    accountId: string | null;
    features: Array<{
      slug: string;
      name: string;
      limit_value: number | null;
      limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
      is_unlimited: boolean;
      category: string | null;
    }>;
  } | null;
  /** Map membership info (for non-member join experience) */
  mapMembership?: {
    isMember: boolean;
    isOwner: boolean;
    onJoinClick?: () => void;
    mapData?: {
      id: string;
      name: string;
      description?: string | null;
      visibility?: 'public' | 'private' | 'shared';
      auto_approve_members?: boolean;
      membership_questions?: Array<{ id: number; question: string }>;
      membership_rules?: string | null;
      settings?: {
        collaboration?: {
          allow_pins?: boolean;
          allow_areas?: boolean;
          allow_posts?: boolean;
          pin_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
          area_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
          post_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
        };
      };
    } | null;
    onJoinSuccess?: () => void;
  } | null;
}

// Default empty handlers to reduce prop boilerplate
const defaultAccountDropdownProps: AccountDropdownProps = {
  onAccountClick: () => {},
  onSignInClick: () => {},
};

/**
 * Inline join form component for non-members
 * Embedded directly in the expanded map info panel
 */
function JoinFormInline({ 
  mapData, 
  onJoinSuccess 
}: { 
  mapData: {
    id: string;
    name: string;
    description?: string | null;
    visibility?: 'public' | 'private' | 'shared';
    auto_approve_members?: boolean;
    membership_questions?: Array<{ id: number; question: string }>;
    membership_rules?: string | null;
    settings?: {
      collaboration?: {
        allow_pins?: boolean;
        allow_areas?: boolean;
        allow_posts?: boolean;
        pin_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
        area_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
        post_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
      };
    };
  };
  onJoinSuccess?: () => void;
}) {
  const { account, activeAccountId } = useAuthStateSafe();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [isCheckingRequest, setIsCheckingRequest] = useState(true);

  const currentAccountId = activeAccountId || account?.id || null;
  const autoApproveMembers = mapData.auto_approve_members || false;
  const membershipQuestions = mapData.membership_questions || [];
  const membershipRules = mapData.membership_rules;
  const allowPins = mapData.settings?.collaboration?.allow_pins || false;
  const allowAreas = mapData.settings?.collaboration?.allow_areas || false;
  const allowPosts = mapData.settings?.collaboration?.allow_posts || false;
  const pinPermissions = mapData.settings?.collaboration?.pin_permissions || null;
  const areaPermissions = mapData.settings?.collaboration?.area_permissions || null;
  const postPermissions = mapData.settings?.collaboration?.post_permissions || null;

  // Check for pending request
  useEffect(() => {
    if (!mapData.id || !currentAccountId) {
      setHasPendingRequest(false);
      setIsCheckingRequest(false);
      return;
    }

    const checkPendingRequest = async () => {
      setIsCheckingRequest(true);
      try {
        const response = await fetch(`/api/maps/${mapData.id}/membership-requests/my-request`);
        if (response.ok) {
          const data = await response.json();
          setHasPendingRequest(!!data.request);
        } else {
          setHasPendingRequest(false);
        }
      } catch (err) {
        setHasPendingRequest(false);
      } finally {
        setIsCheckingRequest(false);
      }
    };

    checkPendingRequest();
  }, [mapData.id, currentAccountId]);

  const handleSubmit = async () => {
    if (!currentAccountId) {
      setError('Please sign in to join this map');
      return;
    }

    const missingAnswers = membershipQuestions.filter(q => !answers[q.id]?.trim());
    if (missingAnswers.length > 0) {
      setError('Please answer all required questions');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const answersArray = membershipQuestions
        .map(q => ({
          question_id: q.id,
          answer: answers[q.id] || '',
        }))
        .filter(a => a.answer.trim());

      const response = await fetch(`/api/maps/${mapData.id}/membership-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArray }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join map');
      }

      const data = await response.json();
      
      if (data.auto_approved) {
        toast.success(`You joined ${mapData.name}`, { duration: 3000 });
        if (onJoinSuccess) onJoinSuccess();
        // Refresh page to update membership state
        window.location.reload();
      } else {
        setHasPendingRequest(true);
        toast.success('Membership request submitted', { duration: 3000 });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join map');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingRequest) {
    return (
      <div className="space-y-1.5 pt-2 border-t border-white/10">
        <div className="text-center py-4">
          <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-white/70">Checking request status...</p>
        </div>
      </div>
    );
  }

  if (hasPendingRequest) {
    return (
      <div className="space-y-1.5 pt-2 border-t border-white/10">
        <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-md p-[10px]">
          <p className="text-xs font-medium text-white mb-1">Request is pending</p>
          <p className="text-xs text-white/80">
            Your membership request is being reviewed by the map owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2 border-t border-white/10">
      {/* Header Message */}
      <div className="bg-indigo-500/20 border border-indigo-400/30 rounded-md p-[10px]">
        <p className="text-xs text-white">
          {autoApproveMembers 
            ? 'Join this map to collaborate and contribute.'
            : 'Request to join this map. Your request will be reviewed by the map owner.'}
        </p>
      </div>

      {/* Collaboration Tools Preview */}
      {(allowPins || allowAreas || allowPosts) && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-white/70">Available Tools</div>
          <div className="bg-white/10 border border-white/20 rounded-md p-[10px]">
            <div className="flex items-center gap-2 flex-wrap">
              {allowPins && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-md border border-white/20">
                  <MapPinIcon className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-xs font-medium text-white">Pins</span>
                  {pinPermissions?.required_plan && (
                    <span className="text-[10px] text-white/60 font-medium">
                      ({pinPermissions.required_plan}+)
                    </span>
                  )}
                </div>
              )}
              {allowAreas && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-md border border-white/20">
                  <Square3Stack3DIcon className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-xs font-medium text-white">Areas</span>
                  {areaPermissions?.required_plan && (
                    <span className="text-[10px] text-white/60 font-medium">
                      ({areaPermissions.required_plan}+)
                    </span>
                  )}
                </div>
              )}
              {allowPosts && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-md border border-white/20">
                  <DocumentTextIcon className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-xs font-medium text-white">Posts</span>
                  {postPermissions?.required_plan && (
                    <span className="text-[10px] text-white/60 font-medium">
                      ({postPermissions.required_plan}+)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Membership Rules */}
      {membershipRules && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-white/70">Membership Rules</div>
          <div className="bg-white/10 border border-white/20 rounded-md p-[10px]">
            <div className="text-xs text-white/90 whitespace-pre-wrap break-words">{membershipRules}</div>
          </div>
        </div>
      )}

      {/* Questions */}
      {membershipQuestions.length > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] font-medium text-white/70">Questions</div>
          {membershipQuestions.map((question) => (
            <div key={question.id} className="space-y-1.5">
              <label className="text-xs font-medium text-white">
                {question.question}
              </label>
              <textarea
                value={answers[question.id] || ''}
                onChange={(e) =>
                  setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))
                }
                placeholder="Your answer..."
                rows={3}
                className="w-full px-2.5 py-1.5 text-xs bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 text-white placeholder:text-white/50 resize-none"
              />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-2 bg-red-500/20 border border-red-400/30 rounded-md">
          <p className="text-xs text-white">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      {currentAccountId ? (
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UserPlusIcon className="w-3 h-3" />
          <span>
            {isSubmitting 
              ? 'Submitting...' 
              : autoApproveMembers 
              ? 'Join Map' 
              : 'Request to Join'}
          </span>
        </button>
      ) : (
        <div className="text-center">
          <p className="text-xs text-white/70 mb-2">Please sign in to join this map</p>
        </div>
      )}
    </div>
  );
}

/**
 * Global page wrapper with 10vh header and 90vh content area
 * - Header: 10vh, black background (or 20vh when #search is active)
 * - Content: 90vh, white background, rounded top corners, scrollable (or 80vh when #search is active)
 * - When #search is active: Header expands to 20vh with full-width search and mention type filters
 */
export default function PageWrapper({ 
  children, 
  headerContent, 
  searchComponent, 
  showAccountDropdown = true, 
  accountDropdownProps = defaultAccountDropdownProps, 
  searchResultsComponent, 
  className = '',
  trackPageView = true,
  viewAsRole,
  mapSettings,
  initialAuth,
  initialBilling,
  mapMembership
}: PageWrapperProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  // Initialize as false to avoid hydration mismatch - will be set correctly on client mount
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isNativeIOSApp = useNativeIOSApp();
  const { account, activeAccountId } = useAuthStateSafe();
  
  // Check if we're on a custom map page (/map/[id] or /map/[slug])
  // Exclude /map/new (create page) and /maps (list page)
  const isMapPage = pathname?.startsWith('/map/') && pathname !== '/map/new' && pathname !== '/maps';
  const isMapsPage = pathname === '/maps' || pathname === '/map';
  
  // Extract map ID/slug from pathname
  const mapIdOrSlug = isMapPage ? pathname.replace('/map/', '').split('/')[0] : null;
  
  // Fetch map info when on a custom map page
  const [mapInfo, setMapInfo] = useState<{ 
    name: string; 
    emoji: string;
    id?: string;
    account_id?: string;
    description?: string | null;
    account?: any;
    viewCount?: number | null;
    pinCount?: number | null;
    memberCount?: number | null;
    visibility?: string;
    created_at?: string;
    updated_at?: string;
    hideCreator?: boolean;
  } | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<'map-info' | 'chat' | null>(null);
  
  // Fetch selected mention types from URL parameters (for header display)
  const [selectedMentionTypes, setSelectedMentionTypes] = useState<Array<{ id: string; name: string; emoji: string; slug: string }>>([]);
  
  // Determine if user is non-member (for forced open state)
  const isNonMember = useMemo(() => {
    return mapMembership && !mapMembership.isMember && !mapMembership.isOwner;
  }, [mapMembership]);
  
  // Auto-open for non-members, close for members when map changes
  useEffect(() => {
    if (isNonMember) {
      // Non-members: always keep open
      setExpandedPanel('map-info');
    } else {
      // Members: reset to closed
      setExpandedPanel(null);
    }
  }, [mapIdOrSlug, isNonMember]);
  
  // Ensure non-members can't close the panel
  const handlePanelToggle = useCallback((panel: 'map-info' | 'chat' | null) => {
    if (isNonMember && panel === null) {
      // Prevent closing for non-members
      return;
    }
    if (isNonMember && expandedPanel === 'map-info' && panel === 'map-info') {
      // Prevent toggling closed for non-members
      return;
    }
    setExpandedPanel(panel);
  }, [isNonMember, expandedPanel]);

  useEffect(() => {
    if (!isMapPage || !mapIdOrSlug || !mounted) {
      setMapInfo(null);
      setSelectedMentionTypes([]);
      return;
    }
    
    const fetchMapInfo = async () => {
      try {
        // Use API endpoint instead of direct Supabase query to handle auth/RLS properly
        const response = await fetch(`/api/maps/${mapIdOrSlug}`);
        
        if (!response.ok) {
          setMapInfo(null);
          return;
        }
        
        const result = await response.json();
        
        // API returns map directly, not wrapped in { map: ... }
        const data = result;
        
        if (!data || !data.id) {
          setMapInfo(null);
          return;
        }
        
        // Fetch view count, pin count, and member count from API
        let viewCount: number | null = null;
        let pinCount: number | null = null;
        let memberCount: number | null = null;
        
        try {
          const statsResponse = await fetch(`/api/maps/${data.id}/stats`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            viewCount = statsData.stats?.total_views || null;
          }
        } catch {
          // View count not available, continue without it
        }
        
        // Fetch pin count
        try {
          const pinsResponse = await fetch(`/api/maps/${data.id}/pins`);
          if (pinsResponse.ok) {
            const pinsData = await pinsResponse.json();
            pinCount = pinsData.pins?.length || 0;
          }
        } catch {
          // Pin count not available, continue without it
        }
        
        // Get member count from map data or fetch separately
        memberCount = data.member_count || null;
        if (memberCount === null) {
          try {
            const membersResponse = await fetch(`/api/maps/${data.id}/members`);
            if (membersResponse.ok) {
              const membersData = await membersResponse.json();
              memberCount = membersData.members?.length || 0;
            }
          } catch {
            // Member count not available, continue without it
          }
        }
        
        const emoji = (data.settings as any)?.meta?.emoji || (data.meta as any)?.emoji || '🗺️';
        setMapInfo({ 
          name: data.name || data.title || 'Map', 
          emoji,
          id: data.id,
          account_id: data.account_id,
          description: data.description,
          account: data.account,
          viewCount,
          pinCount,
          memberCount,
          visibility: data.visibility,
          created_at: data.created_at,
          updated_at: data.updated_at,
          hideCreator: (data.settings as any)?.presentation?.hide_creator || data.hide_creator || false,
        });
      } catch (err) {
        setMapInfo(null);
      }
    };
    
    const fetchSelectedTypes = async () => {
      const typeParam = searchParams.get('type');
      const typesParam = searchParams.get('types');
      
      if (typesParam) {
        const slugs = typesParam.split(',').map(s => s.trim());
        const { data: allTypes } = await supabase
          .from('mention_types')
          .select('id, name, emoji')
          .eq('is_active', true);
        
        if (allTypes) {
          const selected = slugs
            .map(slug => {
              const matchingType = allTypes.find(type => {
                const typeSlug = mentionTypeNameToSlug(type.name);
                return typeSlug === slug;
              });
              return matchingType ? { ...matchingType, slug } : null;
            })
            .filter(Boolean) as Array<{ id: string; name: string; emoji: string; slug: string }>;
          
          setSelectedMentionTypes(selected);
        }
      } else if (typeParam) {
        const { data: allTypes } = await supabase
          .from('mention_types')
          .select('id, name, emoji')
          .eq('is_active', true);
        
        if (allTypes) {
          const matchingType = allTypes.find(type => {
            const typeSlug = mentionTypeNameToSlug(type.name);
            return typeSlug === typeParam;
          });
          
          if (matchingType) {
            setSelectedMentionTypes([{ ...matchingType, slug: typeParam }]);
          }
        }
      }
    };
    
    fetchMapInfo();
    fetchSelectedTypes();
  }, [isMapPage, mapIdOrSlug, mounted, searchParams]);
  
  // Remove a mention type filter
  const handleRemoveType = (slugToRemove: string) => {
    if (!isMapPage || !pathname) return;
    
    const params = new URLSearchParams(searchParams.toString());
    const typeParam = params.get('type');
    const typesParam = params.get('types');
    
    if (typesParam) {
      const slugs = typesParam.split(',').map(s => s.trim()).filter(s => s !== slugToRemove);
      if (slugs.length === 0) {
        params.delete('types');
      } else if (slugs.length === 1) {
        params.delete('types');
        params.set('type', slugs[0]);
      } else {
        params.set('types', slugs.join(','));
      }
    } else if (typeParam && typeParam === slugToRemove) {
      params.delete('type');
    }
    
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };
  
  // Get selected content type for label
  const selectedContentType = searchParams.get('content_type');
  const contentTypeLabels: Record<string, string> = {
    posts: 'Posts',
    mentions: 'Mentions',
    users: 'Users',
    news: 'News',
  };
  const selectedLabel = selectedContentType ? contentTypeLabels[selectedContentType] : null;

  // Automatically track page views for all pages using PageWrapper
  // Uses current pathname, tracks once per page load
  usePageView({ 
    page_url: pathname || '/', 
    enabled: trackPageView 
  });

  // Initialize Facebook Pixel on client side
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).fbq) {
      // Facebook Pixel is already initialized in layout.tsx, but ensure it's available
      // Track page view for Facebook Pixel
      if ((window as any).fbq) {
        (window as any).fbq('track', 'PageView');
      }
    }
  }, [pathname]);

  // Track current hash for active state (only after mount to avoid hydration mismatch)
  const [currentHash, setCurrentHash] = useState<string>('');
  
  // Update hash state after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentHash(window.location.hash);
      
      const handleHashChange = () => {
        setCurrentHash(window.location.hash);
      };
      
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
    return undefined;
  }, []);

  // Memoize navItems to prevent recreation on every render
  // Only show "Add" button on map pages
  const navItems = useMemo(() => {
    const items: Array<{
      label: string;
      href: string | null;
      icon: typeof HomeIcon;
      iconSolid: typeof HomeIconSolid;
      onClick?: (e: React.MouseEvent) => void;
    }> = [
      { label: 'Home', href: '/', icon: HomeIcon, iconSolid: HomeIconSolid },
      { label: 'Maps', href: '/maps', icon: MapIcon, iconSolid: MapIconSolid },
    ];
    
    // Only show "People" link when on a map page
    // Links to current map page with #people hash to show members sidebar
    if (isMapPage && mapIdOrSlug) {
      items.push({
        label: 'People',
        href: `#people`,
        icon: UsersIcon,
        iconSolid: UsersIconSolid,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          if (typeof window !== 'undefined') {
            window.location.hash = 'people';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          }
        }
      });
    }
    
    // Hide Plans icon on custom map pages
    if (!isMapPage) {
      items.push({ label: 'Plans', href: '/plans', icon: CreditCardIcon, iconSolid: CreditCardIconSolid });
    }
    
    return items;
  }, [isMapPage, mapIdOrSlug]);

  // Set mounted flag on client side only
  useEffect(() => {
    setMounted(true);
  }, []);

  // Consolidated hash checking - handles all hash change scenarios in one effect
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const checkHash = () => {
      setIsSearchMode(window.location.hash === '#search');
    };

    // Initial check
    checkHash();

    // Listen for hashchange events (browser navigation and manual dispatches)
    window.addEventListener('hashchange', checkHash);
    
    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', checkHash);

    return () => {
      window.removeEventListener('hashchange', checkHash);
      window.removeEventListener('popstate', checkHash);
    };
  }, [mounted, pathname]); // Include pathname to check hash when route changes

  // Track Facebook Pixel page views on route changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'PageView');
    }
  }, [pathname]);

  // Check if user owns the current map
  const currentAccountId = activeAccountId || account?.id || null;
  const isOwnedMap = useMemo(() => {
    if (!isMapPage || !currentAccountId || !mapInfo) return false;
    // Check both account_id directly and account.id (fallback)
    const mapAccountId = mapInfo.account_id || mapInfo.account?.id;
    return mapAccountId === currentAccountId;
  }, [isMapPage, mapInfo?.account_id, mapInfo?.account?.id, currentAccountId]);

  // Determine background color based on viewAsRole and mapSettings
  // Priority: mapSettings.colors[role] > default gradient (owner) / black (others)
  const backgroundStyle = useMemo(() => {
    // If we have mapSettings and viewAsRole, use the color from settings
    if (mapSettings?.colors && viewAsRole !== undefined) {
      const roleColor = mapSettings.colors[viewAsRole];
      // Check if roleColor exists and is not empty string
      if (roleColor && roleColor.trim() !== '') {
        return {
          background: roleColor,
          backgroundColor: roleColor.startsWith('linear-gradient') ? 'transparent' : roleColor,
        };
      }
    }
    
    // Fallback to default behavior: gradient for owned maps when viewing as owner
    if (isOwnedMap) {
      if (viewAsRole === undefined || viewAsRole === 'owner') {
        return {
          background: 'linear-gradient(to right, #FFB700, #DD4A00, #5C0F2F)',
          backgroundColor: 'transparent',
        };
      }
    }
    
    // Default: black background
    return { 
      background: '#000000',
      backgroundColor: '#000000' 
    };
  }, [isOwnedMap, viewAsRole, mapSettings]);

  // Apply background color to body element
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const bgColor = backgroundStyle.background;
    document.body.style.background = bgColor;
    document.documentElement.style.background = bgColor;

    return () => {
      // Reset on unmount or when condition changes
      document.body.style.background = '';
      document.documentElement.style.background = '';
    };
  }, [backgroundStyle]);

  return (
    <>
      {/* Global Toast System - react-hot-toast (same as admin billing page) */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: '12px',
            padding: '10px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <div 
        className={`relative flex flex-col z-40 ${className}`} 
        style={{ 
          width: '100vw', 
          height: '100vh', 
          maxWidth: '100vw', 
          maxHeight: '100vh',
          overflow: 'hidden',
          ...backgroundStyle
        }}
      >
      {/* Header - Flexible height based on content, black background */}
      <header 
        className="flex flex-col flex-shrink-0 border-b border-white/5"
        style={backgroundStyle}
      >
        {/* Notification window placeholder - 30px height, only on iOS native app */}
        {!isSearchMode && isNativeIOSApp && (
          <div className="w-full" style={{ height: '30px' }} />
        )}
        
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          {/* Top Row: Logo, Search, Nav, Account - Hidden completely in search mode */}
          {!isSearchMode && (
            <div className="grid grid-cols-12 gap-6 items-center transition-all duration-300 h-14">
            {/* 1st Column: Logo & Map Name & Search (Aligns with left sidebar) - Hide search when type param exists */}
            <div className="hidden lg:flex lg:col-span-3 items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            <img
              src="/white-logo.png"
              alt="For the Love of Minnesota"
              className="w-7 h-7"
            />
          </div>
          
          {/* Maps Selector or Search Input - Show maps selector on /map or /maps routes */}
          {isMapsPage || isMapPage ? (
            <div className="flex-1 max-w-[200px] sm:max-w-[250px] transition-all duration-300">
              <MapsSelectorDropdown />
            </div>
          ) : searchComponent ? (
            <div className="flex-1 max-w-[180px] transition-all duration-300">
              {searchComponent}
            </div>
          ) : null}
            </div>
          
            {/* Mobile Header Layout (Logo, Maps Selector/Map Name, Search, Header Content, Account) */}
            <div className="lg:hidden col-span-12 flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  <img src="/white-logo.png" alt="Logo" className="w-6 h-6" />
                </div>
                {/* Maps Selector - shown on /map or /maps routes, next to logo */}
                {(isMapsPage || isMapPage) && (
                  <MapsSelectorDropdown />
                )}
              </div>
              {/* Search Input on mobile - Hidden when on maps page or custom map page */}
              {!isMapsPage && !isMapPage && searchComponent && (
                <div className="flex-1 flex justify-center px-2">
                  <div className="w-full max-w-sm">{searchComponent}</div>
                </div>
              )}
              <div className="flex-shrink-0 flex items-center gap-1">
                {headerContent}
                {showAccountDropdown && (
                  <AccountDropdown 
                    variant="dark"
                    onAccountClick={accountDropdownProps?.onAccountClick}
                    onSignInClick={accountDropdownProps?.onSignInClick}
                  />
                )}
              </div>
            </div>
            
            {/* 2nd Column: Nav Icons or Mention Type Filters (Aligns with center feed, max-width 800px) */}
            <div className="hidden lg:flex lg:col-span-6 justify-center px-4">
              <div className="flex items-center justify-around w-full max-w-[800px]">
                {/* Show nav icons on all pages, including map pages */}
                {navItems.map((item) => {
                  // Hash-based items (like #people) are active when hash matches
                  // Use currentHash state to avoid hydration mismatch (only set after mount)
                  const isActive = item.href?.startsWith('#')
                    ? (mounted && currentHash === item.href)
                    : (item.href && (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))));
                  const Icon = isActive ? item.iconSolid : item.icon;
                  
                  // Handle items with onClick (e.g., hash-based navigation)
                  if ((item as any).onClick) {
                    return (
                      <button
                        key={item.label}
                        onClick={(item as any).onClick}
                        className="flex items-center justify-center w-full h-10 transition-colors hover:bg-white/10 rounded-md"
                      >
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/50'}`} />
                      </button>
                    );
                  }
                  
                  return (
                    <Link
                      key={item.label}
                      href={item.href!}
                      className="flex items-center justify-center w-full h-10 transition-colors hover:bg-white/10 rounded-md"
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/50'}`} />
                    </Link>
                  );
                })}
              </div>
            </div>
            
            {/* Mention Type Filters - Show below nav icons on map pages when types are selected */}
            {isMapPage && selectedMentionTypes.length > 0 && (
              <div className="hidden lg:flex lg:col-span-12 justify-center items-center px-4 pt-2">
                <div className="flex flex-wrap items-center gap-2 justify-center">
                  {selectedMentionTypes.map((type) => (
                    <div
                      key={type.id}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-md text-xs border whitespace-nowrap bg-white/10 border-white/30 text-white"
                    >
                      <span className="text-base flex-shrink-0">{type.emoji}</span>
                      <span className="font-medium leading-none">{type.name}</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveType(type.slug);
                        }}
                        className="hover:opacity-70 transition-opacity flex items-center justify-center flex-shrink-0 leading-none ml-0.5 text-white"
                        aria-label={`Remove ${type.name} filter`}
                      >
                        <XCircleIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 3rd Column: Header Content, Account Dropdown (Aligns with right sidebar) */}
            <div className="hidden lg:flex lg:col-span-3 justify-end items-center gap-2">
              {headerContent}
              {showAccountDropdown && (
                <AccountDropdown 
                  variant="dark"
                  onAccountClick={accountDropdownProps?.onAccountClick}
                  onSignInClick={accountDropdownProps?.onSignInClick}
                />
              )}
            </div>
            </div>
          )}
        </div>

        {/* Search Mode Header (Transitions in when isSearchMode is true) */}
        {isSearchMode && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300 pt-1">
            <div className="flex items-center gap-2">
              {/* Logo - Left of search input */}
              <div className="flex-shrink-0">
                <img
                  src="/white-logo.png"
                  alt="For the Love of Minnesota"
                  className="w-7 h-7"
                />
              </div>
              {/* Label area - shows selected content type */}
              {selectedLabel && (
                <div className="flex-shrink-0 px-2 py-1 text-xs font-semibold text-white bg-white/10 rounded-md">
                  {selectedLabel}
                </div>
              )}
              <div className="flex-1">
                {searchComponent}
              </div>
              <button
                onClick={() => {
                  const newUrl = pathname + window.location.search;
                  window.history.pushState({}, '', newUrl);
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }}
                className="lg:hidden text-white/70 text-xs font-medium px-2 py-1"
              >
                Cancel
              </button>
            </div>
            
            {/* Bottom Row: Content Type Filters */}
            <div className="flex-shrink-0 px-2 pt-1 pb-1 flex justify-center border-t border-white/5">
              <ContentTypeFilters />
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area - Flex to fill remaining space, white background, rounded top corners */}
      <div 
        className="bg-white rounded-t-3xl flex-1 overflow-hidden relative flex flex-col"
        style={{ minHeight: 0 }}
      >
        {/* Scrollable Content Container - Hidden scrollbar, with bottom padding on mobile for fixed nav */}
        {/* Disable scrolling for map pages (except live map) - map container handles its own scrolling */}
        <div 
          className={`flex-1 overflow-x-hidden scrollbar-hide lg:pb-0 ${
            isMapPage ? 'overflow-hidden pb-0' : 'overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))]'
          }`}
          style={{ minHeight: 0 }}
        >
          {isSearchMode && searchResultsComponent ? searchResultsComponent : children}
        </div>
      </div>

      {/* Floating Map Info Card (Mobile + Desktop for non-members) */}
      {!isSearchMode && (
        <div className={`fixed bottom-0 left-0 right-0 z-50 ${
          // Show on mobile always, show on desktop only for non-members
          mapMembership && !mapMembership.isMember && !mapMembership.isOwner ? '' : 'lg:hidden'
        }`}>
          <div 
            className={`backdrop-blur-lg border-t border-white/10 rounded-t-2xl shadow-2xl px-2 py-1 transition-all duration-300 flex flex-col ${
              expandedPanel === 'map-info' ? 'h-[80vh]' : ''
            }`}
            style={{ ...backgroundStyle, paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {isMapPage && mapInfo ? (
              <div className="flex flex-col gap-2 px-2 py-1.5 h-full">
                {/* Map Card Info and Chat Button Row */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Map Card Info - Accordion trigger */}
                  <button
                    onClick={() => handlePanelToggle(expandedPanel === 'map-info' ? null : 'map-info')}
                    disabled={!!(isNonMember && expandedPanel === 'map-info')}
                    className={`flex-1 flex items-center gap-2 px-2 py-2 hover:bg-white/5 rounded-lg transition-colors ${
                      expandedPanel === 'map-info' ? 'bg-white/5' : ''
                    } ${isNonMember && expandedPanel === 'map-info' ? 'cursor-default' : ''}`}
                  >
                    {/* Owner Avatar */}
                    {mapInfo.account && !mapInfo.hideCreator && (
                      <div className="flex-shrink-0">
                        {mapInfo.account.image_url ? (
                          <Image
                            src={mapInfo.account.image_url}
                            alt={mapInfo.account.username || mapInfo.account.first_name || 'User'}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full object-cover border border-white/20"
                            unoptimized
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                            <span className="text-xs text-white/70 font-medium">
                              {(mapInfo.account.first_name?.[0] || mapInfo.account.username?.[0] || 'U').toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Title & Owner */}
                    <div className="flex-1 min-w-0 text-left">
                      {mapInfo.name && (
                        <div className="text-xs font-semibold text-white truncate">
                          {mapInfo.name}
                        </div>
                      )}
                      {mapInfo.account && !mapInfo.hideCreator && (
                        <div className="text-[10px] text-white/70 truncate">
                          {mapInfo.account.username 
                            ? `@${mapInfo.account.username}`
                            : mapInfo.account.first_name && mapInfo.account.last_name
                            ? `${mapInfo.account.first_name} ${mapInfo.account.last_name}`
                            : mapInfo.account.first_name || 'User'}
                        </div>
                      )}
                    </div>

                    {/* View Count */}
                    {mapInfo.viewCount !== null && mapInfo.viewCount !== undefined && (
                      <div className="flex items-center gap-1 text-[10px] text-white/70 flex-shrink-0">
                        <EyeIcon className="w-3.5 h-3.5" />
                        <span>{mapInfo.viewCount.toLocaleString()}</span>
                      </div>
                    )}
                  </button>

                  {/* Chat Button - Hide for non-members */}
                  {!isNonMember && (
                    <button
                      onClick={() => handlePanelToggle(expandedPanel === 'chat' ? null : 'chat')}
                      className={`flex-shrink-0 p-2 hover:bg-white/5 rounded-lg transition-colors ${
                        expandedPanel === 'chat' ? 'bg-white/5' : ''
                      }`}
                      aria-label="Open chat"
                    >
                      <ChatBubbleLeftIcon className={`w-5 h-5 ${expandedPanel === 'chat' ? 'text-white' : 'text-white/70'}`} />
                    </button>
                  )}
                </div>

                {/* Expanded Map Details Content - 80vh max height, scrollable */}
                {expandedPanel === 'map-info' && mapInfo && (
                  <div className="flex-1 overflow-y-auto px-2 pt-1 pb-2 space-y-2 border-t border-white/10 animate-in fade-in slide-in-from-top-2 duration-200 min-h-0">
                    {/* Title - Inline */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-white/70">Title:</span>
                      <span className="text-xs font-medium text-white">{mapInfo.name}</span>
                    </div>
                    
                    {/* Description - Inline */}
                    {mapInfo.description && (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-medium text-white/70 flex-shrink-0">Description:</span>
                        <span className="text-xs text-white/90 whitespace-pre-wrap break-words flex-1">{mapInfo.description}</span>
                      </div>
                    )}
                    
                    {/* Owner - Inline */}
                    {mapInfo.account && !mapInfo.hideCreator && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-white/70 flex-shrink-0">Owner:</span>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {mapInfo.account.image_url ? (
                            <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 border border-white/20">
                              <Image
                                src={mapInfo.account.image_url}
                                alt={mapInfo.account.username || mapInfo.account.first_name || 'User'}
                                width={16}
                                height={16}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/20">
                              <span className="text-[8px] text-white/70">
                                {(mapInfo.account.first_name?.[0] || mapInfo.account.username?.[0] || 'U').toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="text-xs font-medium text-white truncate">
                            {mapInfo.account.username 
                              ? `@${mapInfo.account.username}`
                              : mapInfo.account.first_name && mapInfo.account.last_name
                              ? `${mapInfo.account.first_name} ${mapInfo.account.last_name}`
                              : mapInfo.account.first_name || 'User'}
                          </span>
                          {account && mapInfo.account && account.id === mapInfo.account.id && (
                            <span className="text-[10px] font-medium text-white/70 bg-white/10 px-1.5 py-0.5 rounded flex-shrink-0">
                              Owner
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Settings - Inline */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-white/70">Visibility:</span>
                      <span className="text-xs font-medium text-white capitalize">{mapInfo.visibility || 'private'}</span>
                    </div>
                    
                    {/* Statistics - Inline */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {mapInfo.viewCount !== null && mapInfo.viewCount !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <EyeIcon className="w-3.5 h-3.5 text-white/70" />
                          <span className="text-[10px] font-medium text-white/70">Views:</span>
                          <span className="text-xs font-medium text-white">
                            {mapInfo.viewCount.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {mapInfo.pinCount !== null && mapInfo.pinCount !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <MapPinIcon className="w-3.5 h-3.5 text-white/70" />
                          <span className="text-[10px] font-medium text-white/70">Pins:</span>
                          <span className="text-xs font-medium text-white">
                            {mapInfo.pinCount.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {mapInfo.memberCount !== null && mapInfo.memberCount !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <UsersIcon className="w-3.5 h-3.5 text-white/70" />
                          <span className="text-[10px] font-medium text-white/70">Members:</span>
                          <span className="text-xs font-medium text-white">
                            {mapInfo.memberCount.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Timestamps - Inline */}
                    {(mapInfo.created_at || mapInfo.updated_at) && (
                      <div className="flex flex-col gap-1">
                        {mapInfo.created_at && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium text-white/70">Created:</span>
                            <span className="text-xs text-white/80">
                              {new Date(mapInfo.created_at).toLocaleDateString()} {new Date(mapInfo.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                        {mapInfo.updated_at && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium text-white/70">Updated:</span>
                            <span className="text-xs text-white/80">
                              {new Date(mapInfo.updated_at).toLocaleDateString()} {new Date(mapInfo.updated_at).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline Join Form for Non-Members */}
                    {mapMembership && !mapMembership.isMember && !mapMembership.isOwner && mapMembership.mapData && (
                      <JoinFormInline
                        mapData={mapMembership.mapData}
                        onJoinSuccess={() => {
                          mapMembership.onJoinSuccess?.();
                          // Panel will auto-close when membership updates
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Expanded Chat Feed Skeleton */}
                {expandedPanel === 'chat' && (
                  <div className="px-2 pt-1 pb-2 space-y-3 border-t border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="text-xs font-semibold text-white mb-2">Chat</div>
                    {/* Skeleton feed items */}
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-start gap-2 p-[10px] bg-white/10 border border-white/20 rounded-md">
                        {/* Avatar skeleton */}
                        <div className="w-6 h-6 rounded-full bg-white/10 flex-shrink-0 animate-pulse" />
                        {/* Content skeleton */}
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
                            <div className="h-2 w-12 bg-white/10 rounded animate-pulse" />
                          </div>
                          <div className="space-y-1">
                            <div className="h-3 w-full bg-white/10 rounded animate-pulse" />
                            <div className="h-3 w-3/4 bg-white/10 rounded animate-pulse" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Mention Type Filters */}
                {selectedMentionTypes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 justify-center pt-1 border-t border-white/10">
                    {selectedMentionTypes.map((type) => (
                      <div
                        key={type.id}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-md text-xs border whitespace-nowrap bg-white/10 border-white/30 text-white"
                      >
                        <span className="text-base flex-shrink-0">{type.emoji}</span>
                        <span className="font-medium leading-none">{type.name}</span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveType(type.slug);
                          }}
                          className="hover:opacity-70 transition-opacity flex items-center justify-center flex-shrink-0 leading-none ml-0.5 text-white"
                          aria-label={`Remove ${type.name} filter`}
                        >
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-around">
                {navItems.map((item) => {
                  // Hash-based items use currentHash state to avoid hydration mismatch
                  const isActive = item.href?.startsWith('#')
                    ? (mounted && currentHash === item.href)
                    : (item.href && (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))));
                  const Icon = isActive ? item.iconSolid : item.icon;
                  
                  // Handle items with onClick (e.g., hash-based navigation)
                  if ((item as any).onClick) {
                    return (
                      <button
                        key={item.label}
                        onClick={(item as any).onClick}
                        className="flex items-center justify-center flex-1 h-9 transition-colors hover:bg-white/10 rounded-xl"
                      >
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/60'}`} />
                      </button>
                    );
                  }
                  
                  return (
                    <Link
                      key={item.label}
                      href={item.href!}
                      className="flex items-center justify-center flex-1 h-9 transition-colors hover:bg-white/10 rounded-xl"
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/60'}`} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}


    </div>
    </>
  );
}
