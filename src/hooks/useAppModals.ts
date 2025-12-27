'use client';

import { useCallback, useState } from 'react';

/**
 * Unified modal state management (local state, not in URL)
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
  | 'atlasEntity'
  | 'coming-soon'
  | 'successPin';

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
  // Atlas Entity modal
  atlasEntityId?: string;
  atlasEntityTableName?: string;
  // Coming soon
  comingSoonFeature?: string;
  // Success pin modal
  successPinData?: {
    id?: string;
    lat: number;
    lng: number;
    description: string | null;
    media_url: string | null;
    status?: 'loading' | 'success' | 'error';
    error?: string;
  };
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
  openAtlasEntity: (entityId: string, tableName: string) => void;
  openComingSoon: (feature: string) => void;
  openSuccessPin: (pinData: { id?: string; lat: number; lng: number; description: string | null; media_url: string | null; status?: 'loading' | 'success' | 'error'; error?: string }) => void;
  updateSuccessPin: (updates: { id?: string; status?: 'loading' | 'success' | 'error'; error?: string; media_url?: string | null }) => void;
  
  // Close
  closeModal: () => void;
  
  // Helpers
  getIntelligenceContext: () => typeof modalContext.intelligenceLocation;
  getAtlasContext: () => typeof modalContext.atlasEntityData;
}

export function useAppModals(): UseAppModalsReturn {
  const [modal, setModal] = useState<AppModalState>({ type: 'none' });

  const isModalOpen = modal.type !== 'none';

  // Auth modals
  const openWelcome = useCallback(() => {
    setModal({ type: 'welcome' });
  }, []);

  const openOnboarding = useCallback(() => {
    setModal({ type: 'onboarding' });
  }, []);

  const openAccount = useCallback((tab?: string) => {
    setModal({
      type: 'account',
      tab: tab || 'settings',
    });
  }, []);

  const openUpgrade = useCallback((feature?: string) => {
    setModal({
      type: 'upgrade',
      feature,
    });
  }, []);

  // Feature modals
  const openIntelligence = useCallback((location?: { lat: number; lng: number; placeName?: string; address?: string }) => {
    modalContext.intelligenceLocation = location || null;
    setModal({ type: 'intelligence' });
  }, []);

  const openAnalytics = useCallback((pinId: string, pinName?: string) => {
    modalContext.analyticsPinName = pinName;
    setModal({
      type: 'analytics',
      pinId,
      pinName,
    });
  }, []);

  const openAtlas = useCallback((mode: 'create' | 'edit', entityType: string, data?: unknown) => {
    modalContext.atlasEntityData = data;
    setModal({
      type: 'atlas',
      mode,
      entityType,
    });
  }, []);

  const openAtlasEntity = useCallback((entityId: string, tableName: string) => {
    setModal({
      type: 'atlasEntity',
      atlasEntityId: entityId,
      atlasEntityTableName: tableName,
    });
  }, []);

  const openComingSoon = useCallback((feature: string) => {
    setModal({
      type: 'coming-soon',
      comingSoonFeature: feature,
    });
  }, []);

  const openSuccessPin = useCallback((pinData: { id?: string; lat: number; lng: number; description: string | null; media_url: string | null; status?: 'loading' | 'success' | 'error'; error?: string }) => {
    setModal({
      type: 'successPin',
      successPinData: {
        ...pinData,
        status: pinData.status || 'loading',
      },
    });
  }, []);

  const updateSuccessPin = useCallback((updates: { id?: string; status?: 'loading' | 'success' | 'error'; error?: string; media_url?: string | null }) => {
    setModal((prev) => {
      if (prev.type === 'successPin' && prev.successPinData) {
        return {
          ...prev,
          successPinData: {
            ...prev.successPinData,
            ...updates,
          },
        };
      }
      return prev;
    });
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    // Clear context
    modalContext.intelligenceLocation = null;
    modalContext.atlasEntityData = undefined;
    modalContext.analyticsPinName = undefined;
    
    setModal({ type: 'none' });
  }, []);

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
    openAtlasEntity,
    openComingSoon,
    openSuccessPin,
    updateSuccessPin,
    closeModal,
    getIntelligenceContext,
    getAtlasContext,
  };
}

