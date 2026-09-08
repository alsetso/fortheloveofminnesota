export { GameAtlasLayer } from '@/features/map/atlas/GameAtlasLayer';
export { AtlasFeatureLabelsLayer } from '@/features/map/atlas/AtlasFeatureLabelsLayer';
export {
  AtlasFeaturePopover,
  type AtlasFeaturePopoverState,
} from '@/features/map/atlas/AtlasFeaturePopover';
export {
  GAME_ATLAS_COLLECTIONS,
  GAME_ATLAS_DEFAULT_SLUGS,
  GAME_ATLAS_COLOR,
  gameAtlasCollectionLabel,
} from '@/features/map/atlas/gameAtlasCollections';
export {
  useGameAtlasEnabledSlugs,
  useGameAtlasCollectionOn,
  toggleGameAtlasCollection,
  setGameAtlasCollectionEnabled,
} from '@/features/map/atlas/gameAtlasVisibilityStore';
