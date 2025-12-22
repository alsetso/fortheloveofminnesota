'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { ActiveModal, LocationData, UseModalManagerReturn } from '../types';

/**
 * URL-based modal state management
 * 
 * Enables:
 * - Shareable links to specific modals (e.g., pin analytics)
 * - Browser back button closes modals naturally
 * - Deep linking to modal states
 * 
 * URL patterns:
 * - /feed?modal=analytics&pinId=abc123
 * - /feed?modal=intelligence
 * - /feed?modal=atlas&mode=create&entityType=park
 */

// Store modal context that can't be serialized to URL
const modalContextStore: {
  intelligenceContext: LocationData | null;
  atlasEntityData: unknown;
  comingSoonFeature: string;
  analyticsPinName?: string;
} = {
  intelligenceContext: null,
  atlasEntityData: undefined,
  comingSoonFeature: '',
  analyticsPinName: undefined,
};

export function useModalManager(): UseModalManagerReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse modal state from URL
  const activeModal = useMemo((): ActiveModal => {
    const modal = searchParams.get('modal');
    
    if (!modal) {
      return { type: 'none' };
    }

    switch (modal) {
      case 'intelligence': {
        return {
          type: 'intelligence',
          context: modalContextStore.intelligenceContext,
        };
      }
      
      case 'analytics': {
        const pinId = searchParams.get('pinId');
        if (pinId) {
          return {
            type: 'analytics',
            pinId,
            pinName: modalContextStore.analyticsPinName,
          };
        }
        return { type: 'none' };
      }
      
      case 'coming_soon': {
        return {
          type: 'coming_soon',
          feature: modalContextStore.comingSoonFeature || 'Feature',
        };
      }
      
      case 'atlas': {
        const mode = searchParams.get('mode') as 'create' | 'edit' | null;
        const entityType = searchParams.get('entityType');
        
        if (mode && entityType) {
          return {
            type: 'atlas_entity',
            mode,
            entityType,
            data: modalContextStore.atlasEntityData,
          };
        }
        return { type: 'none' };
      }
      
      default:
        return { type: 'none' };
    }
  }, [searchParams]);

  // Helper to update URL params (preserves selection params)
  const updateModalUrl = useCallback((params: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    
    // Clear existing modal params only
    ['modal', 'pinId', 'mode', 'entityType'].forEach(key => {
      newParams.delete(key);
    });
    
    // Set new params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null) {
        newParams.set(key, value);
      }
    });
    
    const queryString = newParams.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    
    // Use push for modals so back button closes them
    router.push(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  // Modal actions
  const openIntelligence = useCallback((context: LocationData | null) => {
    modalContextStore.intelligenceContext = context;
    updateModalUrl({ modal: 'intelligence' });
  }, [updateModalUrl]);

  const openAnalytics = useCallback((pinId: string, pinName?: string) => {
    modalContextStore.analyticsPinName = pinName;
    updateModalUrl({
      modal: 'analytics',
      pinId,
    });
  }, [updateModalUrl]);

  const openComingSoon = useCallback((feature: string) => {
    modalContextStore.comingSoonFeature = feature;
    updateModalUrl({ modal: 'coming_soon' });
  }, [updateModalUrl]);

  const openAtlasEntity = useCallback((
    mode: 'create' | 'edit',
    entityType: string,
    data?: unknown
  ) => {
    modalContextStore.atlasEntityData = data;
    updateModalUrl({
      modal: 'atlas',
      mode,
      entityType,
    });
  }, [updateModalUrl]);

  const closeModal = useCallback(() => {
    // Clear context
    modalContextStore.intelligenceContext = null;
    modalContextStore.atlasEntityData = undefined;
    modalContextStore.comingSoonFeature = '';
    modalContextStore.analyticsPinName = undefined;
    
    // Use back if we pushed, otherwise just clear params
    // For simplicity, just clear params
    updateModalUrl({ modal: null });
  }, [updateModalUrl]);

  return {
    activeModal,
    openIntelligence,
    openAnalytics,
    openComingSoon,
    openAtlasEntity,
    closeModal,
  };
}

