# Map Selection Feature

URL-based state management for map interactions. Enables shareable links, deep linking, browser history navigation, and SSR-ready state.

## URL Patterns

```
# Location selected
/feed?sel=location&lat=44.9778&lng=-93.2650&place=Minneapolis

# Pin selected (shareable pin link)
/feed?sel=pin&id=abc123

# Atlas entity selected (shareable city/park/school link)
/feed?sel=entity&type=city&id=xyz789

# Modal open (shareable analytics link)
/feed?sel=pin&id=abc123&modal=analytics&pinId=abc123
```

## Hooks

### `useMapSelection`

Manages the current map selection state via URL parameters.

```tsx
import { useMapSelection } from '@/features/map-selection';

function MapSidebar() {
  const { 
    selection,        // MapSelection discriminated union
    selectLocation,   // (data: LocationData, feature?: FeatureMetadata) => void
    selectPin,        // (data: PinData) => void
    selectAtlasEntity,// (data: AtlasEntity) => void
    clearSelection,   // () => void
    isExpanded,       // boolean - true if anything selected
  } = useMapSelection();

  // Type-safe rendering based on selection type
  switch (selection.type) {
    case 'none':
      return <EmptyState />;
    case 'location':
      return <LocationDetails data={selection.data} feature={selection.feature} />;
    case 'pin':
      return <PinDetails data={selection.data} />;
    case 'atlas_entity':
      return <EntityDetails data={selection.data} />;
  }
}
```

### `useModalManager`

Manages modal state via URL parameters. Uses `router.push` so back button closes modals.

```tsx
import { useModalManager } from '@/features/map-selection';

function MapSidebar() {
  const {
    activeModal,      // ActiveModal discriminated union
    openIntelligence, // (context: LocationData | null) => void
    openAnalytics,    // (pinId: string, pinName?: string) => void
    openComingSoon,   // (feature: string) => void
    openAtlasEntity,  // (mode: 'create' | 'edit', entityType: string, data?: unknown) => void
    closeModal,       // () => void
  } = useModalManager();

  // Render modals based on type
  return (
    <>
      {activeModal.type === 'analytics' && (
        <AnalyticsModal pinId={activeModal.pinId} onClose={closeModal} />
      )}
      {activeModal.type === 'intelligence' && (
        <IntelligenceModal context={activeModal.context} onClose={closeModal} />
      )}
    </>
  );
}
```

### `useMapSearch`

Extracted search logic with Mapbox Geocoding API.

```tsx
import { useMapSearch, type MapboxSearchFeature } from '@/features/map-selection';

function MapSearchInput() {
  const handleSelect = (feature: MapboxSearchFeature) => {
    // Fly to location, select it, etc.
  };

  const {
    query,
    setQuery,
    suggestions,
    isSearching,
    showSuggestions,
    setShowSuggestions,
    selectedIndex,
    handleKeyDown,
  } = useMapSearch({
    accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN!,
    bounds: [-97.24, 43.50, -89.49, 49.38], // Minnesota bounds
    proximity: { lat: 44.9778, lng: -93.2650 }, // Minneapolis
  }, handleSelect);

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Search locations..."
    />
  );
}
```

## Migration Guide

### Before (scattered state)

```tsx
function LocationSidebar() {
  // 35+ useState hooks
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [selectedPin, setSelectedPin] = useState<PinData | null>(null);
  const [selectedAtlasEntity, setSelectedAtlasEntity] = useState<AtlasEntity | null>(null);
  const [isIntelligenceModalOpen, setIsIntelligenceModalOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  // ... 30 more useState calls

  // Impossible states are representable
  // (what if both selectedPin AND selectedAtlasEntity are set?)
}
```

### After (consolidated URL-based state)

```tsx
function LocationSidebar() {
  // 3 hooks replace 35+ useState calls
  const { selection, selectPin, selectLocation, selectAtlasEntity, clearSelection } = useMapSelection();
  const { activeModal, openAnalytics, openIntelligence, closeModal } = useModalManager();
  const search = useMapSearch({ accessToken: '...' }, handleSearchSelect);

  // Impossible states are unrepresentable
  // selection.type can only be ONE of: 'none' | 'location' | 'pin' | 'atlas_entity'
}
```

## Benefits

1. **Shareable Links**: Users can share exact map states
2. **Deep Linking**: External links can open specific pins/locations
3. **Browser History**: Back/forward navigation works naturally
4. **SSR Ready**: State can be initialized from URL on server
5. **Type Safety**: Discriminated unions prevent impossible states
6. **Testable**: Hooks can be unit tested in isolation
7. **Debuggable**: Current state visible in URL bar



