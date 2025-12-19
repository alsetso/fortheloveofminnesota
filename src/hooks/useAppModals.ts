'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

/**
 * Unified URL-based modal state management
 * 
 * All app modals are controlled via URL parameters for:
 * - Deep linking (shareable URLs)
 * - Browser back button support
 * - Consistent state across refreshes
 * 
 * URL patterns:
 * - /?modal=welcome
 * - /?modal=onboarding
 * - /?modal=account&tab=settings
 * - /?modal=account&tab=billing
 * - /?modal=upgrade&feature=intelligence
 * - /?modal=intelligence
 * - /?modal=analytics&pinId=abc123
 * - /?modal=atlas&mode=create&entityType=park
 */

// All modal types in the app
export type AppModalType =
  | 'none'
  // Auth/User modals
  | 'welcome'
  | 'onboarding'
  | 'account'
  | 'upgrade'
  // Map/Feature modals
  | 'intelligence'
  | 'analytics'
  | 'atlas'
  | 'coming-soon';

// Modal state with context
export interface AppModalState {
  type: AppModalType;
  // Account modal
  tab?: string;
  // Upgrade modal
  feature?: string;
  // Analytics modal
  pinId?: string;
  pinName?: string;
  // Atlas modal
  mode?: 'create' | 'edit';
  entityType?: string;
  // Coming soon
  comingSoonFeature?: string;
}

// Non-serializable context (stored in memory, not URL)
const modalContext: {
  intelligenceLocation: { lat: number; lng: number; placeName?: string; address?: string } | null;
  atlasEntityData: unknown;
  analyticsPinName?: string;
} = {
  intelligenceLocation: null,
  atlasEntityData: undefined,
  analyticsPinName: undefined,
};

export interface UseAppModalsReturn {
  // Current modal state
  modal: AppModalState;
  isModalOpen: boolean;
  
  // Auth modals
  openWelcome: () => void;
  openOnboarding: () => void;
  openAccount: (tab?: string) => void;
  openUpgrade: (feature?: string) => void;
  
  // Feature modals
  openIntelligence: (location?: { lat: number; lng: number; placeName?: string; address?: string }) => void;
  openAnalytics: (pinId: string, pinName?: string) => void;
  openAtlas: (mode: 'create' | 'edit', entityType: string, data?: unknown) => void;
  openComingSoon: (feature: string) => void;
  
  // Close
  closeModal: () => void;
  
  // Helpers
  getIntelligenceContext: () => typeof modalContext.intelligenceLocation;
  getAtlasContext: () => typeof modalContext.atlasEntityData;
}

export function useAppModals(): UseAppModalsReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse modal state from URL
  const modal = useMemo((): AppModalState => {
    const modalType = searchParams.get('modal') as AppModalType | null;
    
    if (!modalType || modalType === 'none') {
      return { type: 'none' };
    }

    switch (modalType) {
      case 'welcome':
        return { type: 'welcome' };
        
      case 'onboarding':
        return { type: 'onboarding' };
        
      case 'account':
        return {
          type: 'account',
          tab: searchParams.get('tab') || 'settings',
        };
        
      case 'upgrade':
        return {
          type: 'upgrade',
          feature: searchParams.get('feature') || undefined,
        };
        
      case 'intelligence':
        return { type: 'intelligence' };
        
      case 'analytics': {
        const pinId = searchParams.get('pinId');
        if (!pinId) return { type: 'none' };
        return {
          type: 'analytics',
          pinId,
          pinName: modalContext.analyticsPinName,
        };
      }
        
      case 'atlas': {
        const mode = searchParams.get('mode') as 'create' | 'edit' | null;
        const entityType = searchParams.get('entityType');
        if (!mode || !entityType) return { type: 'none' };
        return {
          type: 'atlas',
          mode,
          entityType,
        };
      }
        
      case 'coming-soon':
        return {
          type: 'coming-soon',
          comingSoonFeature: searchParams.get('feature') || 'Feature',
        };
        
      default:
        return { type: 'none' };
    }
  }, [searchParams]);

  const isModalOpen = modal.type !== 'none';

  // Update URL with modal params
  const updateUrl = useCallback((params: Record<string, string | null>, replace = false) => {
    const newParams = new URLSearchParams(searchParams.toString());
    
    // Clear all modal-related params first
    ['modal', 'tab', 'feature', 'pinId', 'mode', 'entityType'].forEach(key => {
      newParams.delete(key);
    });
    
    // Set new params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        newParams.set(key, value);
      }
    });
    
    const queryString = newParams.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    
    if (replace) {
      router.replace(newUrl, { scroll: false });
    } else {
      router.push(newUrl, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  // Auth modals
  const openWelcome = useCallback(() => {
    updateUrl({ modal: 'welcome' });
  }, [updateUrl]);

  const openOnboarding = useCallback(() => {
    updateUrl({ modal: 'onboarding' });
  }, [updateUrl]);

  const openAccount = useCallback((tab?: string) => {
    updateUrl({
      modal: 'account',
      tab: tab || 'settings',
    });
  }, [updateUrl]);

  const openUpgrade = useCallback((feature?: string) => {
    updateUrl({
      modal: 'upgrade',
      feature: feature || null,
    });
  }, [updateUrl]);

  const openGuestDetails = useCallback(() => {
    updateUrl({ modal: 'guest-details' });
  }, [updateUrl]);

  // Feature modals
  const openIntelligence = useCallback((location?: { lat: number; lng: number; placeName?: string; address?: string }) => {
    modalContext.intelligenceLocation = location || null;
    updateUrl({ modal: 'intelligence' });
  }, [updateUrl]);

  const openAnalytics = useCallback((pinId: string, pinName?: string) => {
    modalContext.analyticsPinName = pinName;
    updateUrl({
      modal: 'analytics',
      pinId,
    });
  }, [updateUrl]);

  const openAtlas = useCallback((mode: 'create' | 'edit', entityType: string, data?: unknown) => {
    modalContext.atlasEntityData = data;
    updateUrl({
      modal: 'atlas',
      mode,
      entityType,
    });
  }, [updateUrl]);

  const openComingSoon = useCallback((feature: string) => {
    updateUrl({
      modal: 'coming-soon',
      feature,
    });
  }, [updateUrl]);

  // Close modal
  const closeModal = useCallback(() => {
    // Clear context
    modalContext.intelligenceLocation = null;
    modalContext.atlasEntityData = undefined;
    modalContext.analyticsPinName = undefined;
    
    updateUrl({ modal: null }, true);
  }, [updateUrl]);

  // Context getters
  const getIntelligenceContext = useCallback(() => modalContext.intelligenceLocation, []);
  const getAtlasContext = useCallback(() => modalContext.atlasEntityData, []);

  return {
    modal,
    isModalOpen,
    openWelcome,
    openOnboarding,
    openAccount,
    openUpgrade,
    openIntelligence,
    openAnalytics,
    openAtlas,
    openComingSoon,
    closeModal,
    getIntelligenceContext,
    getAtlasContext,
  };
}
