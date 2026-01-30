'use client';

import React, { useMemo, lazy, Suspense } from 'react';
import type { UnifiedSidebarType } from '@/hooks/useUnifiedSidebar';
import MapFilterContent from '@/components/layout/MapFilterContent';
import type { MapData } from '@/types/map';

// Lazy load large sidebar components for better initial bundle size
const MapSettingsSidebar = lazy(() => import('../components/MapSettingsSidebar'));
const MemberManager = lazy(() => import('../components/MemberManager'));
const JoinMapSidebar = lazy(() => import('../components/JoinMapSidebar'));
const MapPosts = lazy(() => import('../components/MapPosts'));
const MentionDetailSidebar = lazy(() => import('../components/MentionDetailSidebar'));
const EntityDetailSidebar = lazy(() => import('../components/EntityDetailSidebar'));

// Loading fallback component
const SidebarLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center p-[10px]">
    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
  </div>
);

interface UseMapSidebarConfigsOptions {
  mapData: MapData | null;
  mapId: string | null;
  isOwner: boolean;
  isMember: boolean;
  isManager: boolean;
  showMembers: boolean;
  currentAccountId: string | null;
  closeSidebar: () => void;
  onMapDataUpdate: (updated: Partial<MapData>) => void;
  onJoinSuccess: () => void;
  permissionsLoading?: boolean;
  // Entity sidebar state
  selectedMentionId: string | null;
  selectedMention: any | null;
  selectedEntityId: string | null;
  selectedEntityType: 'mention' | 'pin' | 'area' | null;
  selectedEntity: any | null;
  onEntityDeleted?: () => void;
  onEntityUpdated?: (updated: any) => void;
}

/**
 * Hook to build sidebar configurations for the map page
 * Extracts 140+ lines of config building logic from page component
 */
export function useMapSidebarConfigs({
  mapData,
  mapId,
  isOwner,
  isMember,
  isManager,
  showMembers,
  currentAccountId,
  closeSidebar,
  onMapDataUpdate,
  onJoinSuccess,
  permissionsLoading = false,
  selectedMentionId,
  selectedMention,
  selectedEntityId,
  selectedEntityType,
  selectedEntity,
  onEntityDeleted,
  onEntityUpdated,
}: UseMapSidebarConfigsOptions) {
  const sidebarConfigs = useMemo(() => {
    if (!mapData) return [];

    const configs: Array<{
      type: UnifiedSidebarType;
      title: string;
      content: React.ReactNode;
      popupType?: 'create' | 'home' | 'settings' | 'analytics' | 'location' | 'collections' | 'account' | 'search' | 'members';
      darkMode?: boolean;
      infoText?: string;
    }> = [
      {
        type: 'filter',
        title: 'Filter Map',
        content: <MapFilterContent onClose={closeSidebar} />,
        popupType: 'search',
      },
    ];

    // Settings visible to members and owners only (read-only for members, editable for owners)
    if (isMember || isOwner) {
      configs.push({
        type: 'settings' as const,
        title: 'Map Settings',
        content: (
          <Suspense fallback={<SidebarLoadingFallback />}>
            <MapSettingsSidebar
            initialMap={{
              id: mapData.id,
              account_id: mapData.account_id,
              name: mapData.name,
              description: mapData.description,
              slug: mapData.slug,
              visibility: mapData.visibility,
              boundary: mapData.boundary || 'statewide',
              boundary_data: mapData.boundary_data || null,
              settings: mapData.settings || {
                appearance: {
                  map_style: 'street',
                  map_layers: {},
                  meta: {},
                },
                collaboration: {
                  allow_pins: false,
                  allow_areas: false,
                  allow_posts: false,
                },
                presentation: {
                  hide_creator: false,
                  is_featured: false,
                },
              },
              auto_approve_members: mapData.auto_approve_members || false,
              membership_rules: mapData.membership_rules || null,
              membership_questions: mapData.membership_questions || [],
              tags: mapData.tags,
              created_at: mapData.created_at,
              updated_at: mapData.updated_at,
            }}
            onUpdated={(updated) => {
              onMapDataUpdate(updated);
            }}
            onClose={closeSidebar}
            isOwner={isOwner}
            userRole={isOwner ? 'owner' : (isManager ? 'manager' : (isMember ? 'editor' : null))}
            />
          </Suspense>
        ),
        popupType: 'settings',
      });
    }

    if (showMembers) {
      configs.push({
        type: 'members' as const,
        title: 'Members',
        content: (
          <Suspense fallback={<SidebarLoadingFallback />}>
            <MemberManager
            mapId={mapData.id}
            mapAccountId={mapData.account_id}
            autoApproveMembers={mapData.auto_approve_members || false}
            membershipQuestions={mapData.membership_questions || []}
            membershipRules={mapData.membership_rules || null}
            onClose={closeSidebar}
            mapName={mapData.name}
            />
          </Suspense>
        ),
        popupType: 'members' as const,
        infoText: 'Manage map members, roles, and membership requests',
      });
    }

    // Show join sidebar if user is not a member and not an owner
    // Note: We allow joining regardless of collaboration settings - the map owner
    // can configure membership rules/questions to control access
    if (!isMember && !isOwner && currentAccountId) {
      configs.push({
        type: 'join' as const,
        title: 'Join Map',
        content: (
          <Suspense fallback={<SidebarLoadingFallback />}>
            <JoinMapSidebar
            mapId={mapData.id}
            mapName={mapData.name}
            mapData={mapData}
            autoApproveMembers={mapData.auto_approve_members || false}
            membershipQuestions={(mapData.membership_questions || []).map((q: any, index: number) => ({
              id: q.id !== undefined ? q.id : index,
              question: q.question || q,
            }))}
            membershipRules={mapData.membership_rules || null}
            allowPins={mapData.settings?.collaboration?.allow_pins || false}
            allowAreas={mapData.settings?.collaboration?.allow_areas || false}
            allowPosts={mapData.settings?.collaboration?.allow_posts || false}
            pinPermissions={mapData.settings?.collaboration?.pin_permissions || null}
            areaPermissions={mapData.settings?.collaboration?.area_permissions || null}
            postPermissions={mapData.settings?.collaboration?.post_permissions || null}
            mapLayers={mapData.settings?.appearance?.map_layers || {}}
            memberCount={mapData.member_count || 0}
            visibility={mapData.visibility || 'private'}
            onJoinSuccess={onJoinSuccess}
            onClose={closeSidebar}
            />
          </Suspense>
        ),
        popupType: 'account',
      });
    }

    // Add posts section - only for members and owners, and only for live map
    // Posts are temporarily removed from custom maps
    const isLiveMap = mapData?.slug === 'live' || mapId === 'live';
    if ((isMember || isOwner) && isLiveMap && mapData) {
      configs.push({
        type: 'posts' as const,
        title: 'Posts',
        content: (
          <Suspense fallback={<SidebarLoadingFallback />}>
            <MapPosts mapId={mapData.id} mapSlug={mapData.slug} onClose={closeSidebar} />
          </Suspense>
        ),
        popupType: 'account',
        infoText: 'Posts associated with this map',
      });
    }

    // Add mention sidebar if a mention is selected
    // Only check selectedMentionId to prevent sidebar from disappearing if mention object changes
    if (selectedMentionId) {
      configs.push({
        type: 'mention' as const,
        title: 'Mention Details',
        content: selectedMention ? (
          <Suspense fallback={<SidebarLoadingFallback />}>
            <MentionDetailSidebar
              mention={selectedMention}
              isOwner={isOwner}
              permissionsLoading={permissionsLoading}
              onClose={closeSidebar}
              onDeleted={onEntityDeleted}
              mapId={mapData.id}
            />
          </Suspense>
        ) : (
          <div className="p-3 text-xs text-gray-500 text-center">Loading mention details...</div>
        ),
        popupType: 'account',
      });
    }

    // Add entity sidebar if a pin/area is selected
    if (selectedEntityId && selectedEntity && selectedEntityType && (selectedEntityType === 'pin' || selectedEntityType === 'area')) {
      configs.push({
        type: 'entity' as const,
        title: selectedEntityType === 'pin' ? 'Pin Details' : 'Area Details',
        content: (
          <Suspense fallback={<SidebarLoadingFallback />}>
            <EntityDetailSidebar
              entity={selectedEntity}
              entityType={selectedEntityType}
              isOwner={isOwner}
              permissionsLoading={permissionsLoading}
              mapId={mapData.id}
              onClose={closeSidebar}
              onDeleted={onEntityDeleted}
              onUpdated={onEntityUpdated}
            />
          </Suspense>
        ),
        popupType: 'account',
      });
    }

    return configs;
  }, [
    mapData,
    mapId,
    isOwner,
    showMembers,
    isMember,
    isManager,
    currentAccountId,
    closeSidebar,
    onMapDataUpdate,
    onJoinSuccess,
    permissionsLoading,
    selectedMentionId,
    selectedMention,
    selectedEntityId,
    selectedEntityType,
    selectedEntity,
    onEntityDeleted,
    onEntityUpdated,
  ]);

  return sidebarConfigs;
}
