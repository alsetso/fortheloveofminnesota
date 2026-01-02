// Atlas feature exports

// Components
export { default as MapLayersPanel, useAtlasLayers } from './components/MapLayersPanel';
export type { AtlasLayer } from './components/MapLayersPanel';

// Explore/Cities/Counties Components
export { CitiesListView } from './components/CitiesListView';
export { CountiesListView } from './components/CountiesListView';
export { default as CityPageClient } from './components/CityPageClient';
export { default as CountyPageClient } from './components/CountyPageClient';
export { default as LocationPageClient } from './components/LocationPageClient';
export { default as CityMap } from './components/CityMap';
export { default as CityEditButton } from './components/CityEditButton';
export { default as CityEditModal } from './components/CityEditModal';
export { default as CountyMap } from './components/CountyMap';
export { default as CountyEditButton } from './components/CountyEditButton';
export { default as CountyEditModal } from './components/CountyEditModal';

// Services (functions only, types exported separately)
export {
  getNeighborhoods,
  getNeighborhoodBySlug,
  getSchools,
  getSchoolBySlug,
  getParks,
  getParkBySlug,
  getLakes,
  getLakeByName,
  checkLakeExists,
  deleteNeighborhood,
  deleteSchool,
  deletePark,
  deleteLake,
  deleteWatertower,
  deleteCemetery,
  deleteGolfCourse,
  deleteHospital,
  deleteAirport,
  deleteChurch,
  deleteMunicipal,
  deleteRoad,
  deleteRadioAndNews,
  getCities,
  getCounties,
  findCityByName,
  findCityByCoordinates,
  updateCityCoordinates,
  findCountyByName,
  generateSlug,
} from './services/atlasService';
export type { AtlasEntityType } from './services/atlasService';

// Types
export type * from './types';

