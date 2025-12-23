/**
 * Mapbox feature category mappings
 * Based on mapbox/hoverentities.md
 * 
 * Maps Mapbox layer classes/types to our internal categories which then
 * map to atlas entity types for admin creation tools.
 */

export type FeatureCategory =
  // Roads & Paths
  | 'highway'
  | 'road'
  | 'street'
  | 'path'
  | 'trail'
  // Places
  | 'city'
  | 'neighborhood'
  // Nature
  | 'park'
  | 'lake'
  // Buildings
  | 'building'
  | 'house' // Special: building with type=house (shows intelligence button)
  // Atlas Entity Types (direct mappings)
  | 'school'
  | 'hospital'
  | 'church'
  | 'cemetery'
  | 'airport'
  | 'golf_course'
  | 'watertower'
  | 'municipal'
  | 'radio_and_news'
  // Non-atlas POIs (no admin create)
  | 'restaurant'
  | 'grocery'
  | 'store'
  | 'hotel'
  | 'gas_station'
  | 'entertainment'
  | 'poi'
  | 'unknown';

// ═══════════════════════════════════════════════════════════════════════════
// ROAD CLASS → CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════════

export const ROAD_CATEGORIES: Record<string, FeatureCategory> = {
  // Highways (Interstate/Freeway)
  motorway: 'highway',
  motorway_link: 'highway',
  trunk: 'highway',
  trunk_link: 'highway',
  // Major Roads
  primary: 'road',
  primary_link: 'road',
  secondary: 'road',
  secondary_link: 'road',
  tertiary: 'road',
  tertiary_link: 'road',
  unclassified: 'road',
  service: 'road',
  // Streets
  residential: 'street',
  living_street: 'street',
  street_major: 'street',
  street_minor: 'street',
  street: 'street',
  // Paths
  pedestrian: 'path',
  footway: 'path',
  path: 'path',
  cycleway: 'path',
  steps: 'path',
  corridor: 'path',
  // Trails
  bridleway: 'trail',
  track: 'trail',
};

// ═══════════════════════════════════════════════════════════════════════════
// PLACE TYPE → CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════════

export const PLACE_CATEGORIES: Record<string, FeatureCategory> = {
  settlement: 'city',
  city: 'city',
  town: 'city',
  village: 'city',
  hamlet: 'city',
  settlement_subdivision: 'neighborhood',
  neighborhood: 'neighborhood',
  suburb: 'neighborhood',
  quarter: 'neighborhood',
};

// ═══════════════════════════════════════════════════════════════════════════
// LANDUSE CLASS → CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════════

export const LANDUSE_CATEGORIES: Record<string, FeatureCategory> = {
  park: 'park',
  park_like: 'park',
  playground: 'park',
  recreation_ground: 'park',
  nature_reserve: 'park',
  cemetery: 'cemetery',
  grave_yard: 'cemetery',
  grass: 'park',
  golf_course: 'golf_course',
};

// ═══════════════════════════════════════════════════════════════════════════
// WATER TYPE → CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════════

export const WATER_CATEGORIES: Record<string, FeatureCategory> = {
  water: 'lake',
  lake: 'lake',
  pond: 'lake',
  river: 'lake',
  reservoir: 'lake',
  stream: 'lake',
  canal: 'lake',
  basin: 'lake',
};

// ═══════════════════════════════════════════════════════════════════════════
// BUILDING TYPE → CATEGORY MAPPING
// Special handling for building types
// ═══════════════════════════════════════════════════════════════════════════

export const BUILDING_CATEGORIES: Record<string, FeatureCategory> = {
  // Residential - Special case: shows intelligence button
  home: 'house',
  house: 'house',
  residential: 'house',
  detached: 'house',
  semidetached_house: 'house',
  apartments: 'building',
  terrace: 'house',
  bungalow: 'house',
  cabin: 'house',
  farm: 'house',
  houseboat: 'house',
  static_caravan: 'house',
  
  // Religious
  church: 'church',
  chapel: 'church',
  cathedral: 'church',
  mosque: 'church',
  synagogue: 'church',
  temple: 'church',
  shrine: 'church',
  
  // Medical
  hospital: 'hospital',
  clinic: 'hospital',
  
  // Education
  school: 'school',
  university: 'school',
  college: 'school',
  kindergarten: 'school',
  
  // Municipal/Government
  government: 'municipal',
  civic: 'municipal',
  public: 'municipal',
  fire_station: 'municipal',
  police: 'municipal',
  courthouse: 'municipal',
  townhall: 'municipal',
  city_hall: 'municipal',
  library: 'municipal',
  community_centre: 'municipal',
  post_office: 'municipal',
  
  // Infrastructure
  water_tower: 'watertower',
  
  // Transportation
  airport: 'airport',
  terminal: 'airport',
  hangar: 'airport',
  
  // Media/Broadcast
  radio_station: 'radio_and_news',
  television_station: 'radio_and_news',
  tv_station: 'radio_and_news',
  broadcast: 'radio_and_news',
  media: 'radio_and_news',
  newspaper: 'radio_and_news',
  news: 'radio_and_news',
  
  // Default building types
  commercial: 'building',
  industrial: 'building',
  retail: 'building',
  office: 'building',
  warehouse: 'building',
  garage: 'building',
  shed: 'building',
  roof: 'building',
  construction: 'building',
};

// ═══════════════════════════════════════════════════════════════════════════
// POI CLASS → CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════════

export const POI_CATEGORIES: Record<string, FeatureCategory> = {
  // Maps to Atlas entities
  education: 'school',
  medical: 'hospital',
  religious: 'church',
  place_of_worship: 'church',
  
  // Government/Municipal
  government: 'municipal',
  civic: 'municipal',
  public_building: 'municipal',
  
  // Media/Broadcast
  media: 'radio_and_news',
  broadcast: 'radio_and_news',
  news: 'radio_and_news',
  
  // Non-atlas POIs
  arts_and_entertainment: 'entertainment',
  lodging: 'hotel',
  food_and_drink: 'restaurant',
  fuel: 'gas_station',
  store_like: 'store',
  shop: 'store',
  sport: 'poi',
  leisure: 'poi',
};

// ═══════════════════════════════════════════════════════════════════════════
// POI TYPE → CATEGORY MAPPING (More Specific)
// These take precedence over class mappings
// ═══════════════════════════════════════════════════════════════════════════

export const POI_TYPE_CATEGORIES: Record<string, FeatureCategory> = {
  // Schools/Education
  University: 'school',
  College: 'school',
  School: 'school',
  Kindergarten: 'school',
  'High School': 'school',
  'Elementary School': 'school',
  'Middle School': 'school',
  Academy: 'school',
  Institute: 'school',
  
  // Hospitals/Medical
  Hospital: 'hospital',
  Clinic: 'hospital',
  'Medical Center': 'hospital',
  'Health Center': 'hospital',
  'Emergency Room': 'hospital',
  Pharmacy: 'hospital',
  
  // Churches/Religious
  Church: 'church',
  Chapel: 'church',
  Cathedral: 'church',
  Mosque: 'church',
  Synagogue: 'church',
  Temple: 'church',
  Shrine: 'church',
  Monastery: 'church',
  Convent: 'church',
  'Place of Worship': 'church',
  
  // Cemeteries
  Cemetery: 'cemetery',
  Graveyard: 'cemetery',
  'Memorial Park': 'cemetery',
  Mausoleum: 'cemetery',
  
  // Airports
  Airport: 'airport',
  Airfield: 'airport',
  Heliport: 'airport',
  'Regional Airport': 'airport',
  'International Airport': 'airport',
  
  // Golf Courses
  'Golf Course': 'golf_course',
  'Golf Club': 'golf_course',
  'Country Club': 'golf_course',
  'Driving Range': 'golf_course',
  
  // Water Towers
  'Water Tower': 'watertower',
  'Water Tank': 'watertower',
  
  // Municipal/Government
  'City Hall': 'municipal',
  'Town Hall': 'municipal',
  Courthouse: 'municipal',
  'Government Office': 'municipal',
  'Government Building': 'municipal',
  Library: 'municipal',
  'Public Library': 'municipal',
  'Fire Station': 'municipal',
  'Police Station': 'municipal',
  'Post Office': 'municipal',
  'Community Center': 'municipal',
  'Civic Center': 'municipal',
  
  // Parks
  Park: 'park',
  'National Park': 'park',
  'State Park': 'park',
  'Nature Reserve': 'park',
  Garden: 'park',
  Playground: 'park',
  
  // Radio & News
  'Radio Station': 'radio_and_news',
  'TV Station': 'radio_and_news',
  'Television Station': 'radio_and_news',
  'Broadcast Station': 'radio_and_news',
  'News Station': 'radio_and_news',
  Newspaper: 'radio_and_news',
  'News Office': 'radio_and_news',
  'Media Company': 'radio_and_news',
  'Broadcasting': 'radio_and_news',
  'Radio': 'radio_and_news',
  'Television': 'radio_and_news',
  'TV': 'radio_and_news',
  
  // Non-atlas POIs
  Stadium: 'entertainment',
  Arena: 'entertainment',
  Theater: 'entertainment',
  Theatre: 'entertainment',
  Museum: 'entertainment',
  Casino: 'entertainment',
  Hotel: 'hotel',
  Motel: 'hotel',
  Resort: 'hotel',
  Restaurant: 'restaurant',
  Cafe: 'restaurant',
  'Coffee Shop': 'restaurant',
  Bar: 'restaurant',
  'Grocery Store': 'grocery',
  Grocery: 'grocery',
  Supermarket: 'grocery',
  'Food Store': 'grocery',
  'Gas Station': 'gas_station',
  'Fuel Station': 'gas_station',
  'Service Station': 'gas_station',
};

// ═══════════════════════════════════════════════════════════════════════════
// MAKI ICON → CATEGORY MAPPING
// Mapbox uses maki icons for POIs
// ═══════════════════════════════════════════════════════════════════════════

export const MAKI_CATEGORIES: Record<string, FeatureCategory> = {
  // Schools
  school: 'school',
  college: 'school',
  
  // Hospitals
  hospital: 'hospital',
  doctor: 'hospital',
  dentist: 'hospital',
  pharmacy: 'hospital',
  
  // Churches
  'religious-christian': 'church',
  'religious-jewish': 'church',
  'religious-muslim': 'church',
  'place-of-worship': 'church',
  
  // Cemeteries
  cemetery: 'cemetery',
  
  // Airports
  airport: 'airport',
  heliport: 'airport',
  airfield: 'airport',
  
  // Golf
  golf: 'golf_course',
  
  // Municipal
  town_hall: 'municipal',
  'town-hall': 'municipal',
  library: 'municipal',
  fire_station: 'municipal',
  'fire-station': 'municipal',
  police: 'municipal',
  post: 'municipal',
  
  // Parks
  park: 'park',
  garden: 'park',
  'national-park': 'park',
  
  // Water
  water: 'lake',
  
  // Media/Broadcast (Mapbox doesn't have specific maki icons, but add for name-based detection)
  communications: 'radio_and_news',
  'communications-tower': 'radio_and_news',
  
  // Non-atlas
  restaurant: 'restaurant',
  cafe: 'restaurant',
  bar: 'restaurant',
  grocery: 'grocery',
  shop: 'grocery', // Generic shop icon often used for grocery stores
  supermarket: 'grocery',
  'grocery-store': 'grocery',
  lodging: 'hotel',
  hotel: 'hotel',
  fuel: 'gas_station',
  theater: 'entertainment',
  theatre: 'entertainment',
  stadium: 'entertainment',
  museum: 'entertainment',
};

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY DISPLAY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const CATEGORY_CONFIG: Record<FeatureCategory, { 
  icon: string; 
  label: string; 
  color: string;
  atlasType?: string; // Maps to AtlasEntityType if applicable
  showIntelligence?: boolean; // Special flag for intelligence button
}> = {
  // Roads & Paths
  highway: { icon: '🛣️', label: 'Highway', color: '#EF4444', atlasType: 'road' },
  road: { icon: '🛤️', label: 'Road', color: '#F97316', atlasType: 'road' },
  street: { icon: '🏘️', label: 'Street', color: '#F59E0B', atlasType: 'road' },
  path: { icon: '🚶', label: 'Path', color: '#84CC16', atlasType: 'road' },
  trail: { icon: '🥾', label: 'Trail', color: '#22C55E', atlasType: 'road' },
  
  // Places
  city: { icon: '🏙️', label: 'City', color: '#6366F1' }, // No atlasType - special handling
  neighborhood: { icon: '🏘️', label: 'Neighborhood', color: '#8B5CF6', atlasType: 'neighborhood' },
  
  // Nature
  park: { icon: '🌳', label: 'Park', color: '#10B981', atlasType: 'park' },
  lake: { icon: '💧', label: 'Lake', color: '#0EA5E9', atlasType: 'lake' },
  
  // Buildings
  building: { icon: '🏢', label: 'Building', color: '#64748B' }, // Generic - no intelligence by default
  house: { icon: '🏠', label: 'House', color: '#8B5CF6', showIntelligence: true }, // Residential - shows intelligence
  
  // Atlas Entity Types (direct mappings)
  school: { icon: '🏫', label: 'School', color: '#F59E0B', atlasType: 'school' },
  hospital: { icon: '🏥', label: 'Hospital', color: '#EF4444', atlasType: 'hospital' },
  church: { icon: '⛪', label: 'Church', color: '#8B5CF6', atlasType: 'church' },
  cemetery: { icon: '🪦', label: 'Cemetery', color: '#6B7280', atlasType: 'cemetery' },
  airport: { icon: '✈️', label: 'Airport', color: '#3B82F6', atlasType: 'airport' },
  golf_course: { icon: '⛳', label: 'Golf Course', color: '#22C55E', atlasType: 'golf_course' },
  watertower: { icon: '🗼', label: 'Water Tower', color: '#0EA5E9', atlasType: 'watertower' },
  municipal: { icon: '🏛️', label: 'Municipal', color: '#6366F1', atlasType: 'municipal' },
  radio_and_news: { icon: '📻', label: 'Radio/News', color: '#F43F5E', atlasType: 'radio_and_news' },
  
  // Non-atlas POIs
  restaurant: { icon: '🍽️', label: 'Restaurant', color: '#F97316' },
  grocery: { icon: '🛒', label: 'Grocery Store', color: '#10B981' },
  store: { icon: '🏪', label: 'Store', color: '#06B6D4' },
  hotel: { icon: '🏨', label: 'Hotel', color: '#8B5CF6' },
  gas_station: { icon: '⛽', label: 'Gas Station', color: '#EF4444' },
  entertainment: { icon: '🎭', label: 'Entertainment', color: '#EC4899' },
  poi: { icon: '📍', label: 'Point of Interest', color: '#6366F1' },
  unknown: { icon: '📍', label: 'Location', color: '#9CA3AF' },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Get atlas entity type from category
// ═══════════════════════════════════════════════════════════════════════════

export function getAtlasTypeFromCategory(category: FeatureCategory): string | null {
  return CATEGORY_CONFIG[category]?.atlasType || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Check if category should show intelligence button
// ═══════════════════════════════════════════════════════════════════════════

export function shouldShowIntelligence(category: FeatureCategory): boolean {
  return CATEGORY_CONFIG[category]?.showIntelligence === true;
}


