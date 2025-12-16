# User Maps Services

Service layer for managing user-created maps, points, and sharing functionality.

## Services Overview

### UserMapService
Handles map CRUD operations and access control.

**Key Methods:**
- `createMap(data)`: Create a new map
- `getMapById(mapId)`: Get a single map
- `getMaps(filters?)`: Get all accessible maps (owned + shared)
- `getMapsWithMetadata(filters?)`: Get maps with point/share counts
- `updateMap(mapId, data)`: Update a map (owner only)
- `deleteMap(mapId)`: Delete a map (owner only)
- `checkMapAccess(mapId)`: Check user's access level
- `canEditMap(mapId)`: Check if user can edit
- `canViewMap(mapId)`: Check if user can view

**Example:**
```typescript
import { UserMapService } from '@/features/user-maps/services';

const map = await UserMapService.createMap({
  title: 'My Map',
  description: 'A map for my locations',
});

const maps = await UserMapService.getMaps();
const access = await UserMapService.checkMapAccess(mapId);
```

### UserPointService
Handles point CRUD operations on user maps.

**Key Methods:**
- `createPoint(data)`: Create a new point (requires edit access)
- `getPointById(pointId)`: Get a single point
- `getPointsByMapId(mapId, filters?)`: Get all points for a map
- `getPointsWithMetadata(mapId, filters?)`: Get points with metadata
- `updatePoint(pointId, data)`: Update a point (requires edit access)
- `deletePoint(pointId)`: Delete a point (requires edit access)
- `pointsToGeoJSON(points)`: Convert points to GeoJSON
- `getPointsAsGeoJSON(mapId, filters?)`: Get points as GeoJSON

**Example:**
```typescript
import { UserPointService } from '@/features/user-maps/services';

const point = await UserPointService.createPoint({
  map_id: mapId,
  lat: 44.9778,
  lng: -93.2650,
  label: 'Minneapolis',
  description: 'My favorite city',
});

const points = await UserPointService.getPointsByMapId(mapId);
const geoJSON = await UserPointService.getPointsAsGeoJSON(mapId);
```

### MapShareService
Handles sharing maps with other accounts.

**Key Methods:**
- `createShare(data)`: Share a map with an account (owner only)
- `getSharesByMapId(mapId)`: Get all shares for a map (owner only)
- `getSharesWithAccounts(mapId)`: Get shares with account info
- `updateShare(shareId, data)`: Update share permission (owner only)
- `deleteShare(shareId)`: Remove a share (owner only)
- `getShareByMapAndAccount(mapId, accountId)`: Get specific share

**Example:**
```typescript
import { MapShareService } from '@/features/user-maps/services';

const share = await MapShareService.createShare({
  map_id: mapId,
  account_id: otherAccountId,
  permission: 'edit',
});

const shares = await MapShareService.getSharesWithAccounts(mapId);
```

## Authentication & Authorization

All services require:
1. **Authentication**: User must be logged in
2. **Account Setup**: User must have a complete account profile
3. **Access Control**: Operations respect map ownership and sharing permissions

### Permission Levels

- **Owner**: Full control (create, read, update, delete, share)
- **Edit**: Can view and modify map/points (cannot delete map or manage shares)
- **View**: Can only view map and points

## Error Handling

All services throw descriptive errors:
- Authentication errors: "User must be authenticated"
- Account errors: "Account not found. Please complete your profile setup."
- Permission errors: "You do not have permission to..."
- Not found errors: "Map not found" / "Point not found"

## Service Dependencies

- `UserPointService` depends on `UserMapService` for access checks
- `MapShareService` depends on `UserMapService` for ownership verification
- All services use the shared `supabase` client from `@/lib/supabase`

## Usage in Components

```typescript
'use client';

import { UserMapService, UserPointService } from '@/features/user-maps/services';
import { useEffect, useState } from 'react';

export default function MyMapComponent({ mapId }: { mapId: string }) {
  const [map, setMap] = useState(null);
  const [points, setPoints] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const mapData = await UserMapService.getMapById(mapId);
      const pointsData = await UserPointService.getPointsByMapId(mapId);
      setMap(mapData);
      setPoints(pointsData);
    };
    loadData();
  }, [mapId]);

  // ...
}
```

