'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Mention } from '@/types/mention';

interface MapPin {
  id: string;
  map_id: string;
  emoji: string | null;
  caption: string | null;
  image_url: string | null;
  video_url: string | null;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string;
}

interface MapArea {
  id: string;
  map_id: string;
  name: string;
  description: string | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  created_at: string;
  updated_at: string;
}

type EntityType = 'mention' | 'pin' | 'area';

interface UseEntitySidebarReturn {
  selectedMentionId: string | null;
  selectedEntityId: string | null;
  selectedEntityType: EntityType | null;
  selectedMention: Mention | null;
  selectedEntity: MapPin | MapArea | null;
  openMentionSidebar: (mention: Mention) => void;
  openEntitySidebar: (entity: MapPin | MapArea, type: 'pin' | 'area') => void;
  closeSidebar: () => void;
}

export interface UseEntitySidebarOptions {
  /** When true (e.g. on /maps), do not open sidebar on mention-click or entity-click; pin/mention selection is shown in app footer only. */
  disableForClicks?: boolean;
}

/**
 * Hook to manage entity sidebar state for mentions, pins, and areas
 * Listens to 'mention-click' and 'entity-click' events and manages sidebar state
 */
export function useEntitySidebar(options: UseEntitySidebarOptions = {}): UseEntitySidebarReturn {
  const { disableForClicks = false } = options;
  const [selectedMentionId, setSelectedMentionId] = useState<string | null>(null);
  const [selectedMention, setSelectedMention] = useState<Mention | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<EntityType | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<MapPin | MapArea | null>(null);

  const disableForClicksRef = useRef(disableForClicks);
  disableForClicksRef.current = disableForClicks;

  // Store handlers in refs to prevent re-registration
  const handlersRegisteredRef = useRef(false);

  // Listen to mention-click and entity-click events
  useEffect(() => {
    if (handlersRegisteredRef.current) return;
    handlersRegisteredRef.current = true;

    const handleMentionClick = (event: Event) => {
      if (disableForClicksRef.current) return;
      const customEvent = event as CustomEvent<{ mention: Mention }>;
      const mention = customEvent.detail?.mention;
      
      if (mention && mention.id) {
        setSelectedMention(mention);
        setSelectedMentionId(mention.id);
        setSelectedEntityId(null);
        setSelectedEntityType(null);
        setSelectedEntity(null);
      }
    };

    const handleEntityClick = (event: Event) => {
      if (disableForClicksRef.current) return;
      const customEvent = event as CustomEvent<{ entity: MapPin | MapArea; type: 'pin' | 'area' }>;
      const { entity, type } = customEvent.detail || {};
      
      if (entity && entity.id) {
        setSelectedEntity(entity);
        setSelectedEntityId(entity.id);
        setSelectedEntityType(type);
        setSelectedMentionId(null);
        setSelectedMention(null);
      }
    };

    window.addEventListener('mention-click', handleMentionClick);
    window.addEventListener('entity-click', handleEntityClick);

    return () => {
      window.removeEventListener('mention-click', handleMentionClick);
      window.removeEventListener('entity-click', handleEntityClick);
      handlersRegisteredRef.current = false;
    };
  }, []);

  const openMentionSidebar = useCallback((mention: Mention) => {
    setSelectedMention(mention);
    setSelectedMentionId(mention.id);
    setSelectedEntityId(null);
    setSelectedEntityType(null);
    setSelectedEntity(null);
  }, []);

  const openEntitySidebar = useCallback((entity: MapPin | MapArea, type: 'pin' | 'area') => {
    setSelectedEntity(entity);
    setSelectedEntityId(entity.id);
    setSelectedEntityType(type);
    setSelectedMentionId(null);
    setSelectedMention(null);
  }, []);

  const closeSidebar = useCallback(() => {
    setSelectedMentionId(null);
    setSelectedMention(null);
    setSelectedEntityId(null);
    setSelectedEntityType(null);
    setSelectedEntity(null);
  }, []);

  return {
    selectedMentionId,
    selectedEntityId,
    selectedEntityType,
    selectedMention,
    selectedEntity,
    openMentionSidebar,
    openEntitySidebar,
    closeSidebar,
  };
}
