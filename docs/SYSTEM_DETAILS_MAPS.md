# Maps System - Complete Details

**System ID:** `e27f391f-2bcd-4cf1-aa6a-46d0d43e23fe`  
**Schema:** `maps`  
**Primary Route:** `/maps`

## Routes

| Path | File Path | Has Metadata | Is Draft |
|------|-----------|--------------|----------|
| `/maps` | `src/app/maps/page.tsx` | ✅ | ❌ |
| `/maps/new` | `src/app/maps/new/page.tsx` | ✅ | ❌ |
| `/map/[id]` | `src/app/map/[id]/page.tsx` | ✅ | ❌ |
| `/map/[id]/settings` | `src/app/map/[id]/settings/page.tsx` | ✅ | ❌ |
| `/map/[id]/post/[postId]` | `src/app/map/[id]/post/[postId]/page.tsx` | ✅ | ❌ |
| `/map/[id]/post/[postId]/edit` | `src/app/map/[id]/post/[postId]/edit/page.tsx` | ✅ | ❌ |
| `/map` | `src/app/map/page.tsx` | ✅ | ❌ |

## Database Tables

- `maps.maps`
- `maps.pins`
- `maps.areas`
- `maps.categories`
- `maps.memberships`
- `maps.reactions`
- `maps.requests`
- `maps.tags`

## API Routes

- `GET/POST /api/maps`
- `GET/PUT/DELETE /api/maps/[id]`
- `GET/POST /api/maps/[id]/pins`
- `GET/PUT/DELETE /api/maps/[id]/pins/[pinId]`
- `GET/POST /api/maps/[id]/areas`
- `GET/PUT/DELETE /api/maps/[id]/areas/[areaId]`
- `GET/POST /api/maps/[id]/categories`
- `GET/POST /api/maps/[id]/members`
- `GET/PUT/DELETE /api/maps/[id]/members/[memberId]`
- `GET/POST /api/maps/[id]/membership-requests`
- `GET/PUT/DELETE /api/maps/[id]/membership-requests/[requestId]`
- `GET /api/maps/[id]/membership-requests/my-request`
- `GET /api/maps/[id]/stats`
- `GET /api/maps/[id]/viewers`
- `POST /api/maps/[id]/publish`
- `GET /api/maps/[id]/data`
- `GET /api/maps/stats`
- `GET /api/maps/live/mentions`
- `GET /api/maps/live/mentions/admin`

## Components

- `src/features/map/components/MentionsLayer.tsx`
- `src/features/map/components/CreateMentionModal.tsx`
- `src/features/map/components/CountyBoundariesLayer.tsx`
- `src/features/map/components/CTUBoundariesLayer.tsx`
- `src/features/map/components/CongressionalDistrictsLayer.tsx`
- `src/features/map/components/StateBoundaryLayer.tsx`
- `src/features/map/components/GovernmentBuildingsLayer.tsx`
- `src/components/maps/MapsContent.tsx`
- `src/components/maps/MapsLeftSidebar.tsx`
- `src/components/maps/MapsRightSidebar.tsx`
- `src/components/maps/LiveMapLeftSidebar.tsx`
- `src/components/maps/LiveMapRightSidebar.tsx`
- `src/components/maps/MapActionUpgradePrompt.tsx`
- `src/components/maps/AdminViewToggle.tsx`
- `src/app/maps/components/MapCard.tsx`
- `src/app/maps/components/MapsSidebarContent.tsx`
- `src/app/maps/components/MapDetailsContent.tsx`
- `src/app/maps/components/MapMemberManagerInline.tsx`
- `src/app/maps/components/MapMembersList.tsx`
- `src/app/maps/components/MapDetailsPopup.tsx`
- `src/app/maps/components/MapViewersModal.tsx`
- `src/app/map/[id]/components/MapIDBox.tsx`
- `src/app/map/[id]/components/EntityDetailSidebar.tsx`
- `src/app/map/[id]/components/MentionDetailSidebar.tsx`
- `src/app/map/[id]/components/MapSettingsSidebar.tsx`
- `src/app/map/[id]/components/JoinMapSidebar.tsx`
- `src/app/map/[id]/components/MapMembershipRequests.tsx`
- `src/app/map/[id]/components/MapMemberManagement.tsx`
- `src/app/map/[id]/components/MapAreaDrawModal.tsx`
- `src/app/map/[id]/components/MemberManager.tsx`
- `src/app/map/[id]/components/BoundaryLayersManager.tsx`
- `src/app/map/[id]/components/ContributeOverlay.tsx`

## Services

- `src/features/map/services/locationService.ts`
- `src/features/map/services/locationLookupService.ts`
- `src/features/map/services/addressParser.ts`
- `src/features/map/services/liveBoundaryCache.ts`
- `src/features/map/services/mapStylePreloader.ts`
- `src/features/map/services/minnesotaBoundsService.ts`
- `src/lib/maps/getAccessibleMaps.ts`
- `src/lib/maps/urls.ts`
- `src/lib/maps/memberLimits.ts`
- `src/lib/data/queries/maps.ts`

## Hooks

- `src/features/map/hooks/useLocation.ts`
- `src/app/map/[id]/hooks/useMapPageData.ts`
- `src/app/map/[id]/hooks/useMapMembership.ts`
- `src/app/map/[id]/hooks/useMapboxMap.ts`
- `src/app/map/[id]/hooks/useEntitySidebar.ts`
- `src/app/map/[id]/hooks/useUnifiedMapClickHandler.ts`

## Types

- `src/types/map.ts`

## Utils

- `src/features/map/utils/mapboxLoader.ts`
- `src/features/map/utils/layerOrder.ts`
- `src/features/map/utils/addBuildingExtrusions.ts`
- `src/features/map/config/layerStyles.ts`
- `src/features/map/config.ts`
