/**
 * Map Selection Feature
 * 
 * URL-based state management for map interactions.
 * Provides hooks for selection state, modal management, and search.
 * 
 * @example
 * ```tsx
 * import { useMapSelection, useModalManager, useMapSearch } from '@/features/map-selection';
 * 
 * function MapSidebar() {
 *   const { selection, selectPin, selectLocation, clearSelection } = useMapSelection();
 *   const { activeModal, openAnalytics, closeModal } = useModalManager();
 *   const { query, setQuery, suggestions } = useMapSearch({ accessToken: '...' });
 *   
 *   // selection is a discriminated union - type-safe access
 *   if (selection.type === 'pin') {
 *     return <PinDetails pin={selection.data} />;
 *   }
 * }
 * ```
 */

// Types
export type {
  Coordinates,
  LocationData,
  PinData,
  FeatureMetadata,
  AtlasEntity,
  AtlasEntityLayerType,
  MapSelection,
  ActiveModal,
  SelectionUrlParams,
  ModalUrlParams,
  UseMapSelectionReturn,
  UseModalManagerReturn,
} from './types';

// Hooks
export { 
  useMapSelection, 
  updateSelectionCache, 
  clearSelectionCache 
} from './hooks/useMapSelection';

export { useModalManager } from './hooks/useModalManager';

export { 
  useMapSearch,
  type MapboxSearchFeature,
  type UseMapSearchOptions,
  type UseMapSearchReturn,
} from './hooks/useMapSearch';





