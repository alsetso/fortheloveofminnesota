# User Maps Type System

This directory contains TypeScript types exclusively for user-created maps, points, and sharing functionality. These types are distinct from public map pins.

## Type Categories

### Core Types
- `UserMap`: User-created map entity
- `UserPoint`: Point on a user map
- `MapShare`: Share relationship between map and account
- `MapPermission`: Permission enum ('view' | 'edit')

### Data Transfer Types
- `CreateUserMapData`: For creating new maps
- `UpdateUserMapData`: For updating existing maps
- `CreateUserPointData`: For creating new points
- `UpdateUserPointData`: For updating existing points
- `CreateMapShareData`: For creating new shares
- `UpdateMapShareData`: For updating existing shares

### Extended Types
- `UserMapWithMetadata`: Map with additional computed fields
- `MapShareWithAccount`: Share with account information

### Access Control Types
- `MapAccess`: Access level information
- `MapAccessCheck`: Result of access check

### GeoJSON Types
- `UserPointGeoJSONFeature`: GeoJSON Feature for a point
- `UserPointGeoJSONCollection`: GeoJSON FeatureCollection for points

### Query/Filter Types
- `UserMapFilters`: Filters for querying maps
- `UserPointFilters`: Filters for querying points
- `MapShareFilters`: Filters for querying shares

### Response Types
- `UserMapListResponse`: Response for map list queries
- `UserPointListResponse`: Response for point list queries
- `MapShareListResponse`: Response for share list queries

## Type Guards

- `isMapPermission(value)`: Check if value is valid MapPermission
- `isUserMap(value)`: Check if value is a UserMap
- `isUserPoint(value)`: Check if value is a UserPoint

## Separation from Public Map Pins

These types are intentionally separate from public map pin types (`/src/types/map-pin.ts`) to prevent confusion and type mixing:

- **User Maps/Points**: Private, account-owned, shareable, part of user maps
- **Public Map Pins**: Public, location-based, associated with posts/cities/counties

## Usage

```typescript
import type { UserMap, UserPoint, MapPermission } from '@/features/user-maps/types';

const map: UserMap = { ... };
const point: UserPoint = { ... };
const permission: MapPermission = 'edit';
```

export * from './index';





