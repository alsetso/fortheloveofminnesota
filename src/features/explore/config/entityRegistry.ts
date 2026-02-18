/**
 * Entity Type Registry
 *
 * Every discoverable data type in the platform is declared here.
 * The registry drives:
 *   - Directory pages  (/explore/[type])
 *   - Detail pages     (/explore/[type]/[id])
 *   - Map widget       (if has_geometry)
 *   - Relationship sections on detail pages
 *
 * Adding a new data type = adding an entry here + a DB table.
 * The UI reads this config and auto-generates pages.
 */

import {
  GlobeAltIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  RectangleStackIcon,
  UserGroupIcon,
  NewspaperIcon,
  CloudIcon,
  AcademicCapIcon,
  BuildingLibraryIcon,
  HeartIcon,
  SunIcon,
  MusicalNoteIcon,
  PaperAirplaneIcon,
  FlagIcon,
  HomeModernIcon,
  SignalIcon,
  TrophyIcon,
  SparklesIcon,
  MapIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType } from 'react';

/* ─── core types ─── */

export type EntityTypeId =
  | 'state'
  | 'counties'
  | 'cities-and-towns'
  | 'congressional-districts'
  | 'water'
  | 'school-districts'
  | 'school-buildings'
  | 'officials'
  | 'news'
  /* atlas */
  | 'atlas-schools'
  | 'atlas-parks'
  | 'atlas-hospitals'
  | 'atlas-churches'
  | 'atlas-airports'
  | 'atlas-cemeteries'
  | 'atlas-golf_courses'
  | 'atlas-watertowers'
  | 'atlas-neighborhoods'
  | 'atlas-municipals'
  | 'atlas-roads'
  | 'atlas-radio_and_news'
  | 'atlas-lakes';

export interface StatFieldConfig {
  /** Key in the API response */
  key: string;
  /** Human label */
  label: string;
  /** Format hint for rendering */
  format?: 'number' | 'area-acres' | 'date' | 'string';
}

export interface RelationshipConfig {
  /** Entity type id of the related type */
  targetType: EntityTypeId;
  /** Relationship label shown as section heading */
  label: string;
  /** How to resolve: 'children' (spatial containment), 'scoped' (filtered by parent), 'overlap' */
  kind: 'children' | 'scoped' | 'overlap';
  /** API endpoint to fetch related records */
  apiEndpoint: string;
  /** Query param name used to scope (e.g. county_name) */
  scopeParam?: string;
  /** Which field on the parent record supplies the scope value */
  scopeField?: string;
}

export interface EntityTypeConfig {
  id: EntityTypeId;
  /** URL slug for /explore/[type] */
  slug: string;
  /** Display label (plural) */
  label: string;
  /** Singular label */
  singular: string;
  /** Short description */
  description: string;
  /** Heroicon */
  icon: ComponentType<{ className?: string }>;
  /** API endpoint for fetching list / by ID */
  apiEndpoint: string;
  /** Field used as display name */
  nameField: string;
  /** Fields shown in the stats grid on detail pages */
  statsFields: StatFieldConfig[];
  /** Whether records have GeoJSON geometry */
  hasGeometry: boolean;
  /** Whether records have lat/lng point coordinates */
  hasCoordinates?: boolean;
  /** Relationships to other entity types */
  relationships: RelationshipConfig[];
  /** Which entity type is the spatial parent (for breadcrumbs) */
  parentType?: EntityTypeId;
  /** Fields shown as columns in directory list */
  directoryColumns: { key: string; label: string; format?: 'number' | 'string' }[];
  /** Default sort field for directory */
  defaultSort?: string;
  /** Default sort direction */
  defaultSortDir?: 'asc' | 'desc';
  /** If true, list uses paginated API (limit/offset, { data, total }) and shows Load more */
  supportsPagination?: boolean;
  /** Page size when supportsPagination (default 100) */
  pageSize?: number;
  /** Schema grouping: 'layers' (default) or 'atlas'. Controls API routing and breadcrumbs. */
  schema?: 'layers' | 'atlas';
  /** For atlas tables: the raw DB table name in the atlas schema */
  dbTable?: string;
  /**
   * Child point markers shown on the map when a record of this entity is focused.
   * e.g., school buildings shown inside a school district boundary.
   */
  childPins?: {
    /** API endpoint returning child records with lat/lng */
    apiEndpoint: string;
    /** Query param name to scope children to parent record */
    scopeParam: string;
    /** Field on the parent record supplying the scope value (usually 'id') */
    scopeField: string;
    /** Field on child records used as display name */
    nameField: string;
    /** Pin color (hex) */
    color?: string;
    /** Min zoom for text labels (default 10) */
    labelMinZoom?: number;
    /** If set, API returns this field as GeoJSON geometry and layer renders polygons */
    geometryField?: string;
    /** Entity slug for click-to-navigate (e.g. 'school-buildings') */
    linkSlug?: string;
  };
}

/* ─── registry ─── */

export const ENTITY_REGISTRY: EntityTypeConfig[] = [
  /* ── State ── */
  {
    id: 'state',
    slug: 'state',
    label: 'State Boundary',
    singular: 'State',
    description: 'Complete state boundary of Minnesota',
    icon: GlobeAltIcon,
    apiEndpoint: '/api/civic/state-boundary',
    nameField: 'name',
    statsFields: [],
    hasGeometry: true,
    relationships: [
      {
        targetType: 'counties',
        label: 'Counties',
        kind: 'children',
        apiEndpoint: '/api/civic/county-boundaries',
      },
    ],
    directoryColumns: [{ key: 'name', label: 'Name' }],
  },

  /* ── Counties ── */
  {
    id: 'counties',
    slug: 'counties',
    label: 'Counties',
    singular: 'County',
    description: '87 county boundaries of Minnesota',
    icon: MapPinIcon,
    apiEndpoint: '/api/civic/county-boundaries',
    nameField: 'county_name',
    statsFields: [
      { key: 'county_code', label: 'County Code', format: 'string' },
    ],
    hasGeometry: true,
    parentType: 'state',
    relationships: [
      {
        targetType: 'cities-and-towns',
        label: 'Cities & Towns',
        kind: 'children',
        apiEndpoint: '/api/civic/ctu-boundaries',
        scopeParam: 'county_name',
        scopeField: 'county_name',
      },
    ],
    directoryColumns: [
      { key: 'county_name', label: 'County' },
      { key: 'county_code', label: 'Code' },
    ],
    defaultSort: 'county_name',
    defaultSortDir: 'asc',
  },

  /* ── Cities & Towns ── */
  {
    id: 'cities-and-towns',
    slug: 'cities-and-towns',
    label: 'Cities & Towns',
    singular: 'City / Town',
    description: 'Cities, townships, and municipalities',
    icon: BuildingOfficeIcon,
    apiEndpoint: '/api/civic/ctu-boundaries',
    nameField: 'feature_name',
    statsFields: [
      { key: 'population', label: 'Population', format: 'number' },
      { key: 'acres', label: 'Area', format: 'area-acres' },
      { key: 'ctu_class', label: 'Type', format: 'string' },
      { key: 'county_name', label: 'County', format: 'string' },
    ],
    hasGeometry: true,
    parentType: 'counties',
    relationships: [],
    directoryColumns: [
      { key: 'feature_name', label: 'Name' },
      { key: 'ctu_class', label: 'Type' },
      { key: 'county_name', label: 'County' },
      { key: 'population', label: 'Population', format: 'number' },
    ],
    defaultSort: 'feature_name',
    defaultSortDir: 'asc',
  },

  /* ── Water (NHD water bodies) ── */
  {
    id: 'water',
    slug: 'water',
    label: 'Water Bodies',
    singular: 'Water Body',
    description: 'Lakes and ponds from National Hydrography Dataset',
    icon: CloudIcon,
    apiEndpoint: '/api/civic/water',
    nameField: 'name',
    statsFields: [
      { key: 'gnis_name', label: 'GNIS Name', format: 'string' },
      { key: 'fcode', label: 'Feature Code', format: 'number' },
    ],
    hasGeometry: true,
    parentType: 'state',
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'gnis_name', label: 'GNIS Name' },
      { key: 'fcode', label: 'FCode' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
  },

  /* ── Congressional Districts ── */
  {
    id: 'congressional-districts',
    slug: 'congressional-districts',
    label: 'Congressional Districts',
    singular: 'Congressional District',
    description: 'U.S. Congressional district boundaries',
    icon: RectangleStackIcon,
    apiEndpoint: '/api/civic/congressional-districts',
    nameField: 'district_number',
    statsFields: [],
    hasGeometry: true,
    parentType: 'state',
    relationships: [],
    directoryColumns: [
      { key: 'district_number', label: 'District' },
    ],
    defaultSort: 'district_number',
    defaultSortDir: 'asc',
  },

  /* ── School Districts (MDE boundary polygons) ── */
  {
    id: 'school-districts',
    slug: 'school-districts',
    label: 'School Districts',
    singular: 'School District',
    description: '328 school district boundaries from MDE',
    icon: AcademicCapIcon,
    apiEndpoint: '/api/civic/school-districts',
    nameField: 'name',
    statsFields: [
      { key: 'sd_number', label: 'District Number', format: 'string' },
      { key: 'sd_type', label: 'Type', format: 'string' },
      { key: 'sq_miles', label: 'Area (sq mi)', format: 'number' },
      { key: 'web_url', label: 'Website', format: 'string' },
    ],
    hasGeometry: true,
    parentType: 'state',
    relationships: [
      {
        targetType: 'school-buildings',
        label: 'School Buildings',
        kind: 'children',
        apiEndpoint: '/api/civic/school-buildings',
        scopeParam: 'school_district_id',
        scopeField: 'id',
      },
    ],
    directoryColumns: [
      { key: 'name', label: 'District Name' },
      { key: 'short_name', label: 'Short Name' },
      { key: 'sd_number', label: 'Number' },
      { key: 'sq_miles', label: 'Area (sq mi)', format: 'number' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    childPins: {
      apiEndpoint: '/api/civic/school-buildings',
      scopeParam: 'school_district_id',
      scopeField: 'id',
      nameField: 'name',
      color: '#dc2626',
      labelMinZoom: 12,
      geometryField: 'geometry',
      linkSlug: 'school-buildings',
    },
  },

  /* ── School Buildings (civic infrastructure) ── */
  {
    id: 'school-buildings',
    slug: 'school-buildings',
    label: 'School Buildings',
    singular: 'School Building',
    description: 'Physical school building structures',
    icon: AcademicCapIcon,
    apiEndpoint: '/api/civic/school-buildings',
    nameField: 'name',
    statsFields: [
      { key: 'address', label: 'Address', format: 'string' },
      { key: 'city', label: 'City', format: 'string' },
      { key: 'zip', label: 'ZIP', format: 'string' },
    ],
    hasGeometry: true,
    parentType: 'school-districts',
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
  },

  /* ── Officials (civic.people) ── */
  {
    id: 'officials',
    slug: 'officials',
    label: 'Officials',
    singular: 'Official',
    description: 'Elected and appointed government officials',
    icon: UserGroupIcon,
    apiEndpoint: '/api/explore/officials',
    nameField: 'name',
    statsFields: [
      { key: 'title', label: 'Title', format: 'string' },
      { key: 'party', label: 'Party', format: 'string' },
      { key: 'district', label: 'District', format: 'string' },
    ],
    hasGeometry: false,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'title', label: 'Title' },
      { key: 'party', label: 'Party' },
      { key: 'district', label: 'District' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
  },

  /* ── News ── */
  {
    id: 'news',
    slug: 'news',
    label: 'Minnesota News',
    singular: 'Article',
    description: 'News articles about Minnesota',
    icon: NewspaperIcon,
    apiEndpoint: '/api/news',
    nameField: 'title',
    statsFields: [
      { key: 'source_name', label: 'Source', format: 'string' },
      { key: 'published_at', label: 'Published', format: 'date' },
    ],
    hasGeometry: false,
    relationships: [],
    directoryColumns: [
      { key: 'title', label: 'Title' },
      { key: 'source_name', label: 'Source' },
      { key: 'published_at', label: 'Date' },
    ],
    defaultSort: 'published_at',
    defaultSortDir: 'desc',
  },

  /* ═══════════════════════════════════════════════════════════════
   * ATLAS  —  community entities (point-based, lat/lng)
   * URL pattern: /explore/[slug]
   * ═══════════════════════════════════════════════════════════════ */

  {
    id: 'atlas-schools',
    slug: 'schools',
    label: 'Schools',
    singular: 'School',
    description: '1,184 schools across Minnesota — community profiles',
    icon: AcademicCapIcon,
    apiEndpoint: '/api/atlas/schools',
    nameField: 'name',
    statsFields: [
      { key: 'district_name', label: 'District', format: 'string' },
      { key: 'address', label: 'Address', format: 'string' },
      { key: 'school_type', label: 'Type', format: 'string' },
      { key: 'enrollment', label: 'Enrollment', format: 'number' },
      { key: 'phone', label: 'Phone', format: 'string' },
      { key: 'website_url', label: 'Website', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    parentType: 'school-districts',
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'district_name', label: 'District' },
      { key: 'address', label: 'Address' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'schools',
  },

  {
    id: 'atlas-parks',
    slug: 'parks',
    label: 'Parks',
    singular: 'Park',
    description: 'State, regional, and local parks',
    icon: SunIcon,
    apiEndpoint: '/api/atlas/parks',
    nameField: 'name',
    statsFields: [
      { key: 'park_type', label: 'Type', format: 'string' },
      { key: 'area_acres', label: 'Area', format: 'area-acres' },
      { key: 'address', label: 'Address', format: 'string' },
      { key: 'website_url', label: 'Website', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'park_type', label: 'Type' },
      { key: 'area_acres', label: 'Acres', format: 'number' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'parks',
  },

  {
    id: 'atlas-hospitals',
    slug: 'hospitals',
    label: 'Hospitals',
    singular: 'Hospital',
    description: 'Hospitals and medical centers',
    icon: HeartIcon,
    apiEndpoint: '/api/atlas/hospitals',
    nameField: 'name',
    statsFields: [
      { key: 'address', label: 'Address', format: 'string' },
      { key: 'phone', label: 'Phone', format: 'string' },
      { key: 'website_url', label: 'Website', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'address', label: 'Address' },
      { key: 'phone', label: 'Phone' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'hospitals',
  },

  {
    id: 'atlas-churches',
    slug: 'churches',
    label: 'Churches',
    singular: 'Church',
    description: 'Houses of worship across Minnesota',
    icon: BuildingLibraryIcon,
    apiEndpoint: '/api/atlas/churches',
    nameField: 'name',
    statsFields: [
      { key: 'address', label: 'Address', format: 'string' },
      { key: 'phone', label: 'Phone', format: 'string' },
      { key: 'website_url', label: 'Website', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'address', label: 'Address' },
      { key: 'phone', label: 'Phone' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'churches',
  },

  {
    id: 'atlas-airports',
    slug: 'airports',
    label: 'Airports',
    singular: 'Airport',
    description: 'Airports and airfields in Minnesota',
    icon: PaperAirplaneIcon,
    apiEndpoint: '/api/atlas/airports',
    nameField: 'name',
    statsFields: [
      { key: 'address', label: 'Address', format: 'string' },
      { key: 'phone', label: 'Phone', format: 'string' },
      { key: 'website_url', label: 'Website', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'address', label: 'Address' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'airports',
  },

  {
    id: 'atlas-cemeteries',
    slug: 'cemeteries',
    label: 'Cemeteries',
    singular: 'Cemetery',
    description: 'Cemeteries throughout Minnesota',
    icon: FlagIcon,
    apiEndpoint: '/api/atlas/cemeteries',
    nameField: 'name',
    statsFields: [
      { key: 'address', label: 'Address', format: 'string' },
      { key: 'website_url', label: 'Website', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'address', label: 'Address' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'cemeteries',
  },

  {
    id: 'atlas-golf_courses',
    slug: 'golf-courses',
    label: 'Golf Courses',
    singular: 'Golf Course',
    description: 'Golf courses across the state',
    icon: TrophyIcon,
    apiEndpoint: '/api/atlas/golf_courses',
    nameField: 'name',
    statsFields: [
      { key: 'address', label: 'Address', format: 'string' },
      { key: 'phone', label: 'Phone', format: 'string' },
      { key: 'website_url', label: 'Website', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'address', label: 'Address' },
      { key: 'phone', label: 'Phone' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'golf_courses',
  },

  {
    id: 'atlas-watertowers',
    slug: 'watertowers',
    label: 'Water Towers',
    singular: 'Water Tower',
    description: 'Water towers of Minnesota',
    icon: SparklesIcon,
    apiEndpoint: '/api/atlas/watertowers',
    nameField: 'name',
    statsFields: [
      { key: 'address', label: 'Address', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'address', label: 'Address' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'watertowers',
  },

  {
    id: 'atlas-neighborhoods',
    slug: 'neighborhoods',
    label: 'Neighborhoods',
    singular: 'Neighborhood',
    description: 'Neighborhoods and communities',
    icon: HomeModernIcon,
    apiEndpoint: '/api/atlas/neighborhoods',
    nameField: 'name',
    statsFields: [
      { key: 'address', label: 'Location', format: 'string' },
      { key: 'description', label: 'About', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'neighborhoods',
  },

  {
    id: 'atlas-municipals',
    slug: 'municipals',
    label: 'Municipal Buildings',
    singular: 'Municipal Building',
    description: 'City halls and municipal buildings',
    icon: BuildingOfficeIcon,
    apiEndpoint: '/api/atlas/municipals',
    nameField: 'name',
    statsFields: [
      { key: 'address', label: 'Address', format: 'string' },
      { key: 'phone', label: 'Phone', format: 'string' },
      { key: 'website_url', label: 'Website', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'address', label: 'Address' },
      { key: 'phone', label: 'Phone' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'municipals',
  },

  {
    id: 'atlas-roads',
    slug: 'roads',
    label: 'Roads',
    singular: 'Road',
    description: 'Notable roads and highways',
    icon: MapIcon,
    apiEndpoint: '/api/atlas/roads',
    nameField: 'name',
    statsFields: [
      { key: 'description', label: 'Description', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'roads',
  },

  {
    id: 'atlas-radio_and_news',
    slug: 'radio-and-news',
    label: 'Radio & News',
    singular: 'Station / Outlet',
    description: 'Radio stations and news outlets',
    icon: SignalIcon,
    apiEndpoint: '/api/atlas/radio_and_news',
    nameField: 'name',
    statsFields: [
      { key: 'address', label: 'Address', format: 'string' },
      { key: 'phone', label: 'Phone', format: 'string' },
      { key: 'website_url', label: 'Website', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'address', label: 'Address' },
      { key: 'website_url', label: 'Website' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'radio_and_news',
  },

  {
    id: 'atlas-lakes',
    slug: 'lakes',
    label: 'Lakes',
    singular: 'Lake',
    description: 'Named lakes and waterways',
    icon: CloudIcon,
    apiEndpoint: '/api/atlas/lakes',
    nameField: 'name',
    statsFields: [
      { key: 'address', label: 'Location', format: 'string' },
      { key: 'description', label: 'Description', format: 'string' },
    ],
    hasGeometry: false,
    hasCoordinates: true,
    relationships: [],
    directoryColumns: [
      { key: 'name', label: 'Name' },
      { key: 'address', label: 'Location' },
    ],
    defaultSort: 'name',
    defaultSortDir: 'asc',
    supportsPagination: true,
    pageSize: 100,
    schema: 'atlas',
    dbTable: 'lakes',
  },
];

/* ─── lookup helpers ─── */

export function getEntityConfig(slug: string): EntityTypeConfig | undefined {
  return ENTITY_REGISTRY.find((e) => e.slug === slug);
}

/** Look up by slug, restricted to atlas schema */
export function getAtlasEntityConfig(slug: string): EntityTypeConfig | undefined {
  return ENTITY_REGISTRY.find((e) => e.slug === slug && e.schema === 'atlas');
}

export function getEntityConfigById(id: EntityTypeId): EntityTypeConfig | undefined {
  return ENTITY_REGISTRY.find((e) => e.id === id);
}

/** All slugs that have geometry (used by map view toggle) */
export const SPATIAL_ENTITY_SLUGS = ENTITY_REGISTRY.filter((e) => e.hasGeometry).map((e) => e.slug);

/** All slugs registered (used by routing) */
export const ALL_ENTITY_SLUGS = ENTITY_REGISTRY.map((e) => e.slug);

/** Atlas-only entity configs */
export const ATLAS_ENTITIES = ENTITY_REGISTRY.filter((e) => e.schema === 'atlas');

/** Atlas slug list */
export const ATLAS_ENTITY_SLUGS = ATLAS_ENTITIES.map((e) => e.slug);

/** Build the URL for an entity — all entities live under /explore/{slug} */
export function entityUrl(config: EntityTypeConfig, recordId?: string): string {
  const base = `/explore/${config.slug}`;
  return recordId ? `${base}/${recordId}` : base;
}
