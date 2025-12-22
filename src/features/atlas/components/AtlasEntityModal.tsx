'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  createNeighborhood,
  createSchool,
  createPark,
  createLake,
  createWatertower,
  createCemetery,
  createGolfCourse,
  createHospital,
  createAirport,
  createChurch,
  createMunicipal,
  createRoad,
  createRadioAndNews,
  updateNeighborhood,
  updateSchool,
  updatePark,
  updateLake,
  updateWatertower,
  updateCemetery,
  updateGolfCourse,
  updateHospital,
  updateAirport,
  updateChurch,
  updateMunicipal,
  updateRoad,
  updateRadioAndNews,
  getCities,
  getCounties,
  generateSlug,
  type AtlasEntityType,
} from '@/features/atlas/services/atlasService';

// Entity data that can be passed for editing
export interface AtlasEntityData {
  id: string;
  name: string;
  slug?: string;
  lat?: number;
  lng?: number;
  description?: string;
  website_url?: string;
  phone?: string;
  address?: string;
  city_id?: string;
  county_id?: string;
  school_type?: string;
  is_public?: boolean;
  district?: string;
  park_type?: string;
  hospital_type?: string;
  course_type?: string;
  holes?: number;
  airport_type?: string;
  iata_code?: string;
  icao_code?: string;
  church_type?: string;
  denomination?: string;
  municipal_type?: string;
  road_type?: string;
  route_number?: string;
  direction?: string;
  segment_name?: string;
  start_point?: string;
  end_point?: string;
  mile_marker?: number;
  wikipedia_url?: string;
  // Radio & News fields
  media_type?: string;
  call_sign?: string;
  frequency?: string;
  channel_number?: string;
  format?: string;
  parent_company?: string;
  network_affiliation?: string;
}

interface AtlasEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: AtlasEntityType;
  mode: 'create' | 'edit';
  // For create mode
  coordinates?: { lat: number; lng: number };
  featureName?: string;
  cityName?: string;
  countyName?: string;
  address?: string; // Reverse geocoded address from Mapbox (prop)
  // Feature properties from Mapbox for pre-filling type-specific fields
  featureProperties?: Record<string, any>;
  // For edit mode
  existingEntity?: AtlasEntityData;
  onSuccess?: () => void;
}

interface City {
  id: string;
  name: string;
  slug: string;
}

interface County {
  id: string;
  name: string;
  slug: string;
}

const entityConfig = {
  neighborhood: {
    createTitle: 'Create Neighborhood',
    editTitle: 'Edit Neighborhood',
    nameLabel: 'Neighborhood Name',
    namePlaceholder: 'e.g., Uptown, North Loop',
  },
  school: {
    createTitle: 'Create School',
    editTitle: 'Edit School',
    nameLabel: 'School Name',
    namePlaceholder: 'e.g., Minneapolis South High School',
  },
  park: {
    createTitle: 'Create Park',
    editTitle: 'Edit Park',
    nameLabel: 'Park Name',
    namePlaceholder: 'e.g., Minnehaha Falls Park',
  },
  lake: {
    createTitle: 'Create Lake',
    editTitle: 'Edit Lake',
    nameLabel: 'Lake Name',
    namePlaceholder: 'e.g., Lake Harriet',
  },
  watertower: {
    createTitle: 'Create Watertower',
    editTitle: 'Edit Watertower',
    nameLabel: 'Watertower Name',
    namePlaceholder: 'e.g., Downtown Watertower',
  },
  cemetery: {
    createTitle: 'Create Cemetery',
    editTitle: 'Edit Cemetery',
    nameLabel: 'Cemetery Name',
    namePlaceholder: 'e.g., Lakewood Cemetery',
  },
  golf_course: {
    createTitle: 'Create Golf Course',
    editTitle: 'Edit Golf Course',
    nameLabel: 'Golf Course Name',
    namePlaceholder: 'e.g., Hazeltine National Golf Club',
  },
  hospital: {
    createTitle: 'Create Hospital',
    editTitle: 'Edit Hospital',
    nameLabel: 'Hospital Name',
    namePlaceholder: 'e.g., Mayo Clinic',
  },
  airport: {
    createTitle: 'Create Airport',
    editTitle: 'Edit Airport',
    nameLabel: 'Airport Name',
    namePlaceholder: 'e.g., Minneapolis-Saint Paul International Airport',
  },
  church: {
    createTitle: 'Create Church',
    editTitle: 'Edit Church',
    nameLabel: 'Church Name',
    namePlaceholder: 'e.g., St. Mary\'s Catholic Church',
  },
  municipal: {
    createTitle: 'Create Municipal',
    editTitle: 'Edit Municipal',
    nameLabel: 'Municipal Name',
    namePlaceholder: 'e.g., City Hall, Public Library',
  },
  road: {
    createTitle: 'Create Road',
    editTitle: 'Edit Road',
    nameLabel: 'Road Name',
    namePlaceholder: 'e.g., Interstate 35, Highway 61, County Road 42',
  },
  radio_and_news: {
    createTitle: 'Create Radio/News',
    editTitle: 'Edit Radio/News',
    nameLabel: 'Outlet Name',
    namePlaceholder: 'e.g., WCCO-AM, Star Tribune, KARE 11',
  },
};

const schoolTypes = [
  { value: 'elementary', label: 'Elementary School' },
  { value: 'middle', label: 'Middle School' },
  { value: 'high', label: 'High School' },
  { value: 'k12', label: 'K-12 School' },
  { value: 'university', label: 'University' },
  { value: 'college', label: 'College' },
  { value: 'technical', label: 'Technical School' },
  { value: 'other', label: 'Other' },
];

const parkTypes = [
  { value: 'city', label: 'City Park' },
  { value: 'county', label: 'County Park' },
  { value: 'state', label: 'State Park' },
  { value: 'national', label: 'National Park' },
  { value: 'regional', label: 'Regional Park' },
  { value: 'nature_reserve', label: 'Nature Reserve' },
  { value: 'recreation', label: 'Recreation Area' },
  { value: 'other', label: 'Other' },
];

const hospitalTypes = [
  { value: 'general', label: 'General Hospital' },
  { value: 'specialty', label: 'Specialty Hospital' },
  { value: 'emergency', label: 'Emergency Hospital' },
  { value: 'children', label: 'Children\'s Hospital' },
  { value: 'veterans', label: 'Veterans Hospital' },
  { value: 'teaching', label: 'Teaching Hospital' },
  { value: 'community', label: 'Community Hospital' },
  { value: 'other', label: 'Other' },
];

const golfCourseTypes = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'semi_private', label: 'Semi-Private' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'resort', label: 'Resort' },
  { value: 'other', label: 'Other' },
];

const airportTypes = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'general_aviation', label: 'General Aviation' },
  { value: 'private', label: 'Private' },
  { value: 'military', label: 'Military' },
  { value: 'regional', label: 'Regional' },
  { value: 'international', label: 'International' },
  { value: 'other', label: 'Other' },
];

const churchTypes = [
  { value: 'catholic', label: 'Catholic' },
  { value: 'protestant', label: 'Protestant' },
  { value: 'orthodox', label: 'Orthodox' },
  { value: 'baptist', label: 'Baptist' },
  { value: 'methodist', label: 'Methodist' },
  { value: 'lutheran', label: 'Lutheran' },
  { value: 'presbyterian', label: 'Presbyterian' },
  { value: 'episcopal', label: 'Episcopal' },
  { value: 'non_denominational', label: 'Non-Denominational' },
  { value: 'other', label: 'Other' },
];

const municipalTypes = [
  { value: 'city_hall', label: 'City Hall' },
  { value: 'courthouse', label: 'Courthouse' },
  { value: 'police_station', label: 'Police Station' },
  { value: 'fire_station', label: 'Fire Station' },
  { value: 'library', label: 'Library' },
  { value: 'community_center', label: 'Community Center' },
  { value: 'town_hall', label: 'Town Hall' },
  { value: 'government_office', label: 'Government Office' },
  { value: 'other', label: 'Other' },
];

const roadTypes = [
  { value: 'interstate', label: 'Interstate' },
  { value: 'us_highway', label: 'US Highway' },
  { value: 'state_highway', label: 'State Highway' },
  { value: 'county_road', label: 'County Road' },
  { value: 'local_road', label: 'Local Road' },
  { value: 'township_road', label: 'Township Road' },
  { value: 'private_road', label: 'Private Road' },
  { value: 'trail', label: 'Trail' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'other', label: 'Other' },
];

const roadDirections = [
  { value: 'north', label: 'North' },
  { value: 'south', label: 'South' },
  { value: 'east', label: 'East' },
  { value: 'west', label: 'West' },
  { value: 'northbound', label: 'Northbound' },
  { value: 'southbound', label: 'Southbound' },
  { value: 'eastbound', label: 'Eastbound' },
  { value: 'westbound', label: 'Westbound' },
];

const mediaTypes = [
  { value: 'am_radio', label: 'AM Radio' },
  { value: 'fm_radio', label: 'FM Radio' },
  { value: 'television', label: 'Television' },
  { value: 'newspaper', label: 'Newspaper' },
  { value: 'online_news', label: 'Online News' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'magazine', label: 'Magazine' },
  { value: 'wire_service', label: 'Wire Service' },
  { value: 'other', label: 'Other' },
];

const tvNetworkAffiliations = [
  { value: 'NBC', label: 'NBC' },
  { value: 'CBS', label: 'CBS' },
  { value: 'ABC', label: 'ABC' },
  { value: 'FOX', label: 'FOX' },
  { value: 'PBS', label: 'PBS' },
  { value: 'CW', label: 'The CW' },
  { value: 'MyNetworkTV', label: 'MyNetworkTV' },
  { value: 'Independent', label: 'Independent' },
  { value: 'Other', label: 'Other' },
];

export default function AtlasEntityModal({
  isOpen,
  onClose,
  entityType,
  mode,
  coordinates,
  featureName,
  cityName,
  countyName,
  address: initialAddress,
  featureProperties,
  existingEntity,
  onSuccess,
}: AtlasEntityModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cityId, setCityId] = useState<string>('');
  const [countyId, setCountyId] = useState<string>('');
  const [schoolType, setSchoolType] = useState<string>('');
  const [isPublic, setIsPublic] = useState(true);
  const [district, setDistrict] = useState('');
  const [parkType, setParkType] = useState<string>('');
  const [hospitalType, setHospitalType] = useState<string>('');
  const [courseType, setCourseType] = useState<string>('');
  const [holes, setHoles] = useState<string>('');
  const [airportType, setAirportType] = useState<string>('');
  const [iataCode, setIataCode] = useState('');
  const [icaoCode, setIcaoCode] = useState('');
  const [churchType, setChurchType] = useState<string>('');
  const [denomination, setDenomination] = useState('');
  const [municipalType, setMunicipalType] = useState<string>('');
  const [roadType, setRoadType] = useState<string>('');
  const [routeNumber, setRouteNumber] = useState('');
  const [direction, setDirection] = useState<string>('');
  const [segmentName, setSegmentName] = useState('');
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [mileMarker, setMileMarker] = useState('');
  const [wikipediaUrl, setWikipediaUrl] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  // Radio & News fields
  const [mediaType, setMediaType] = useState<string>('');
  const [callSign, setCallSign] = useState('');
  const [frequency, setFrequency] = useState('');
  const [channelNumber, setChannelNumber] = useState('');
  const [format, setFormat] = useState('');
  const [parentCompany, setParentCompany] = useState('');
  const [networkAffiliation, setNetworkAffiliation] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [citiesLoaded, setCitiesLoaded] = useState(false);
  const [countiesLoaded, setCountiesLoaded] = useState(false);

  const config = entityConfig[entityType];
  const isEditMode = mode === 'edit';
  const title = isEditMode ? config.editTitle : config.createTitle;

  // Load cities and counties
  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        try {
          const [citiesData, countiesData] = await Promise.all([
            getCities(),
            getCounties(),
          ]);
          setCities(citiesData || []);
          setCounties(countiesData || []);
          setCitiesLoaded(true);
          setCountiesLoaded(true);
        } catch (err) {
          console.error('Error loading cities/counties:', err);
        }
      };
      loadData();
    }
  }, [isOpen]);

  // Auto-select city when cities are loaded and cityName is provided (create mode)
  useEffect(() => {
    if (!isEditMode && citiesLoaded && cityName && cities.length > 0 && !cityId) {
      const normalizedCityName = cityName.toLowerCase().trim();
      const matchedCity = cities.find(
        (city) => city.name.toLowerCase().trim() === normalizedCityName
      );
      if (matchedCity) {
        setCityId(matchedCity.id);
      }
    }
  }, [citiesLoaded, cityName, cities, isEditMode, cityId]);

  // Auto-select county when counties are loaded and countyName is provided (create mode)
  useEffect(() => {
    if (!isEditMode && countiesLoaded && countyName && counties.length > 0 && !countyId) {
      const normalizedCountyName = countyName.toLowerCase().trim().replace(' county', '');
      const matchedCounty = counties.find(
        (county) => county.name.toLowerCase().trim().replace(' county', '') === normalizedCountyName
      );
      if (matchedCounty) {
        setCountyId(matchedCounty.id);
      }
    }
  }, [countiesLoaded, countyName, counties, isEditMode, countyId]);

  // Initialize/reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setCitiesLoaded(false);
      setCountiesLoaded(false);

      if (isEditMode && existingEntity) {
        // Populate from existing entity
        setName(existingEntity.name || '');
        setDescription(existingEntity.description || '');
        setCityId(existingEntity.city_id || '');
        setCountyId(existingEntity.county_id || '');
        setSchoolType(existingEntity.school_type || '');
        setIsPublic(existingEntity.is_public !== false);
        setDistrict(existingEntity.district || '');
        setParkType(existingEntity.park_type || '');
        setHospitalType(existingEntity.hospital_type || '');
        setCourseType(existingEntity.course_type || '');
        setHoles(existingEntity.holes?.toString() || '');
        setAirportType(existingEntity.airport_type || '');
        setIataCode(existingEntity.iata_code || '');
        setIcaoCode(existingEntity.icao_code || '');
        setChurchType(existingEntity.church_type || '');
        setDenomination(existingEntity.denomination || '');
        setMunicipalType(existingEntity.municipal_type || '');
        setRoadType(existingEntity.road_type || '');
        setRouteNumber(existingEntity.route_number || '');
        setDirection(existingEntity.direction || '');
        setSegmentName(existingEntity.segment_name || '');
        setStartPoint(existingEntity.start_point || '');
        setEndPoint(existingEntity.end_point || '');
        setMileMarker(existingEntity.mile_marker?.toString() || '');
        setWikipediaUrl(existingEntity.wikipedia_url || '');
        setAddress(existingEntity.address || '');
        setPhone(existingEntity.phone || '');
        setWebsiteUrl(existingEntity.website_url || '');
        // Radio & News fields
        setMediaType(existingEntity.media_type || '');
        setCallSign(existingEntity.call_sign || '');
        setFrequency(existingEntity.frequency || '');
        setChannelNumber(existingEntity.channel_number || '');
        setFormat(existingEntity.format || '');
        setParentCompany(existingEntity.parent_company || '');
        setNetworkAffiliation(existingEntity.network_affiliation || '');
        setLat(existingEntity.lat);
        setLng(existingEntity.lng);
      } else {
        // Create mode - use coordinates, feature name, and feature properties
        const props = featureProperties || {};
        
        setName(featureName || '');
        setDescription('');
        setCityId('');
        setCountyId('');
        
        // Pre-fill type-specific fields from Mapbox feature properties
        // School fields
        setSchoolType(props.school_type || '');
        setIsPublic(props.is_public !== false);
        setDistrict(props.district || props.operator || '');
        
        // Park fields
        setParkType(props.park_type || props.leisure || '');
        
        // Hospital fields
        setHospitalType(props.hospital_type || props.healthcare || '');
        
        // Golf course fields
        setCourseType(props.course_type || '');
        setHoles(props.holes?.toString() || '');
        
        // Airport fields
        setAirportType(props.airport_type || props.aeroway || '');
        setIataCode(props.iata || props.iata_code || '');
        setIcaoCode(props.icao || props.icao_code || '');
        
        // Church fields - Mapbox uses 'denomination' and 'religion'
        setChurchType(props.church_type || props.religion || '');
        setDenomination(props.denomination || '');
        
        // Municipal fields
        setMunicipalType(props.municipal_type || props.government || '');
        
        // Road fields - extract from Mapbox road properties
        const roadClass = props.class || '';
        let detectedRoadType = '';
        if (roadClass === 'motorway' || roadClass === 'motorway_link') {
          detectedRoadType = 'interstate';
        } else if (roadClass === 'trunk' || roadClass === 'primary') {
          detectedRoadType = 'us_highway';
        } else if (roadClass === 'secondary' || roadClass === 'tertiary') {
          detectedRoadType = 'state_highway';
        } else if (roadClass === 'residential' || roadClass === 'living_street') {
          detectedRoadType = 'local_road';
        }
        setRoadType(props.road_type || detectedRoadType || '');
        setRouteNumber(props.ref || props.route_number || '');
        setDirection('');
        setSegmentName('');
        setStartPoint('');
        setEndPoint('');
        setMileMarker('');
        setWikipediaUrl(props.wikipedia || props.wikipedia_url || '');
        
        // Address and contact - from Mapbox POI properties
        setAddress(initialAddress || props.address || '');
        setPhone(props.phone || '');
        setWebsiteUrl(props.website || props.website_url || '');
        
        // Radio & News fields
        setMediaType('');
        setCallSign('');
        setFrequency('');
        setChannelNumber('');
        setFormat('');
        setParentCompany(props.operator || props.brand || '');
        setNetworkAffiliation(props.network || '');
        
        setLat(coordinates?.lat);
        setLng(coordinates?.lng);
      }
    }
  }, [isOpen, isEditMode, existingEntity, featureName, coordinates, initialAddress, featureProperties]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const slug = generateSlug(name);
      const baseData = {
        name: name.trim(),
        slug,
        lat,
        lng,
        description: description.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        website_url: websiteUrl.trim() || null,
      };

      if (isEditMode && existingEntity) {
        // Update existing entity
        switch (entityType) {
          case 'neighborhood':
            await updateNeighborhood(existingEntity.id, {
              name: name.trim(),
              slug,
              lat,
              lng,
              description: description.trim() || null,
              website_url: websiteUrl.trim() || null,
              city_id: cityId || null,
            });
            break;

          case 'school':
            await updateSchool(existingEntity.id, {
              ...baseData,
              city_id: cityId || null,
              school_type: (schoolType as any) || null,
              is_public: isPublic,
              district: district.trim() || null,
            });
            break;

          case 'park':
            await updatePark(existingEntity.id, {
              ...baseData,
              city_id: cityId || null,
              county_id: countyId || null,
              park_type: (parkType as any) || null,
            });
            break;

          case 'lake':
            await updateLake(existingEntity.id, {
              name: name.trim(),
              lat,
              lng,
            });
            break;

          case 'watertower':
            await updateWatertower(existingEntity.id, {
              ...baseData,
              city_id: cityId || null,
            });
            break;

          case 'cemetery':
            await updateCemetery(existingEntity.id, {
              ...baseData,
              city_id: cityId || null,
            });
            break;

          case 'golf_course':
            await updateGolfCourse(existingEntity.id, {
              ...baseData,
              city_id: cityId || null,
              course_type: (courseType as any) || null,
              holes: holes ? parseInt(holes) : null,
            });
            break;

          case 'hospital':
            await updateHospital(existingEntity.id, {
              ...baseData,
              city_id: cityId || null,
              hospital_type: (hospitalType as any) || null,
            });
            break;

          case 'airport':
            await updateAirport(existingEntity.id, {
              ...baseData,
              city_id: cityId || null,
              airport_type: (airportType as any) || null,
              iata_code: iataCode.trim() || null,
              icao_code: icaoCode.trim() || null,
            });
            break;

          case 'church':
            await updateChurch(existingEntity.id, {
              ...baseData,
              city_id: cityId || null,
              church_type: (churchType as any) || null,
              denomination: denomination.trim() || null,
            });
            break;

          case 'municipal':
            await updateMunicipal(existingEntity.id, {
              ...baseData,
              city_id: cityId || null,
              municipal_type: (municipalType as any) || null,
            });
            break;

          case 'road':
            await updateRoad(existingEntity.id, {
              name: name.trim(),
              slug: slug,
              lat,
              lng,
              description: description.trim() || null,
              city_id: cityId || null,
              road_type: (roadType as any) || null,
              route_number: routeNumber.trim() || null,
              direction: (direction as any) || null,
              segment_name: segmentName.trim() || null,
              start_point: startPoint.trim() || null,
              end_point: endPoint.trim() || null,
              mile_marker: mileMarker ? parseFloat(mileMarker) : null,
              wikipedia_url: wikipediaUrl.trim() || null,
            });
            break;

          case 'radio_and_news':
            await updateRadioAndNews(existingEntity.id, {
              name: name.trim(),
              slug: slug,
              lat,
              lng,
              description: description.trim() || null,
              city_id: cityId || null,
              media_type: (mediaType as any) || 'other',
              call_sign: callSign.trim() || null,
              frequency: frequency.trim() || null,
              channel_number: channelNumber.trim() || null,
              format: format.trim() || null,
              address: address.trim() || null,
              phone: phone.trim() || null,
              website_url: websiteUrl.trim() || null,
              parent_company: parentCompany.trim() || null,
              network_affiliation: networkAffiliation.trim() || null,
              wikipedia_url: wikipediaUrl.trim() || null,
            });
            break;
        }
      } else {
        // Create new entity
        switch (entityType) {
          case 'neighborhood':
            await createNeighborhood({
              name: name.trim(),
              slug,
              lat,
              lng,
              description: description.trim() || null,
              website_url: websiteUrl.trim() || null,
              city_id: cityId || null,
            });
            break;

          case 'school':
            await createSchool({
              ...baseData,
              city_id: cityId || null,
              school_type: (schoolType as any) || null,
              is_public: isPublic,
              district: district.trim() || null,
            });
            break;

          case 'park':
            await createPark({
              ...baseData,
              city_id: cityId || null,
              county_id: countyId || null,
              park_type: (parkType as any) || null,
            });
            break;

          case 'lake':
            await createLake({
              name: name.trim(),
              lat,
              lng,
            });
            break;

          case 'watertower':
            await createWatertower({
              ...baseData,
              city_id: cityId || null,
            });
            break;

          case 'cemetery':
            await createCemetery({
              ...baseData,
              city_id: cityId || null,
            });
            break;

          case 'golf_course':
            await createGolfCourse({
              ...baseData,
              city_id: cityId || null,
              course_type: (courseType as any) || null,
              holes: holes ? parseInt(holes) : null,
            });
            break;

          case 'hospital':
            await createHospital({
              ...baseData,
              city_id: cityId || null,
              hospital_type: (hospitalType as any) || null,
            });
            break;

          case 'airport':
            await createAirport({
              ...baseData,
              city_id: cityId || null,
              airport_type: (airportType as any) || null,
              iata_code: iataCode.trim() || null,
              icao_code: icaoCode.trim() || null,
            });
            break;

          case 'church':
            await createChurch({
              ...baseData,
              city_id: cityId || null,
              church_type: (churchType as any) || null,
              denomination: denomination.trim() || null,
            });
            break;

          case 'municipal':
            await createMunicipal({
              ...baseData,
              city_id: cityId || null,
              municipal_type: (municipalType as any) || null,
            });
            break;

          case 'road':
            await createRoad({
              name: name.trim(),
              slug,
              lat,
              lng,
              description: description.trim() || null,
              city_id: cityId || null,
              road_type: (roadType as any) || null,
              route_number: routeNumber.trim() || null,
              direction: (direction as any) || null,
              segment_name: segmentName.trim() || null,
              start_point: startPoint.trim() || null,
              end_point: endPoint.trim() || null,
              mile_marker: mileMarker ? parseFloat(mileMarker) : null,
              wikipedia_url: wikipediaUrl.trim() || null,
            });
            break;

          case 'radio_and_news':
            await createRadioAndNews({
              name: name.trim(),
              slug,
              lat,
              lng,
              description: description.trim() || null,
              city_id: cityId || null,
              media_type: (mediaType as any) || 'other',
              call_sign: callSign.trim() || null,
              frequency: frequency.trim() || null,
              channel_number: channelNumber.trim() || null,
              format: format.trim() || null,
              address: address.trim() || null,
              phone: phone.trim() || null,
              website_url: websiteUrl.trim() || null,
              parent_company: parentCompany.trim() || null,
              network_affiliation: networkAffiliation.trim() || null,
              wikipedia_url: wikipediaUrl.trim() || null,
            });
            break;
        }
      }

      // Refresh the corresponding atlas layer on the map (autoEnable for new entities)
      const layerIdMap: Record<AtlasEntityType, string> = {
        neighborhood: 'neighborhoods',
        school: 'schools',
        park: 'parks',
        lake: 'lakes',
        watertower: 'watertowers',
        cemetery: 'cemeteries',
        golf_course: 'golf_courses',
        hospital: 'hospitals',
        airport: 'airports',
        church: 'churches',
        municipal: 'municipals',
        road: 'roads',
        radio_and_news: 'radio_and_news',
      };
      window.dispatchEvent(new CustomEvent('atlas-layer-refresh', {
        detail: { layerId: layerIdMap[entityType], autoEnable: !isEditMode }
      }));

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} entity:`, err);
      setError(err.message || `Failed to ${isEditMode ? 'update' : 'create'}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative bg-white/10 backdrop-blur rounded-lg border border-white/20 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-white/70 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3 space-y-3">
          {error && (
            <div className="px-2 py-1.5 text-xs text-red-300 bg-red-500/20 rounded-md border border-red-500/30">
              {error}
            </div>
          )}

          {/* Coordinates Display */}
          {(lat !== undefined && lng !== undefined) && (
            <div className="px-2 py-1.5 bg-white/5 rounded-md border border-white/10">
              <div className="text-[10px] text-white/50">
                Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-white/80 mb-1">
              {config.nameLabel} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={config.namePlaceholder}
              className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-white/80 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={2}
              className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 resize-none"
            />
          </div>

          {/* City Dropdown (for all except lake) */}
          {entityType !== 'lake' && (
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                City
              </label>
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
              >
                <option value="">Select a city...</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Address (for new entity types) */}
          {(entityType === 'watertower' || entityType === 'cemetery' || entityType === 'golf_course' || entityType === 'hospital' || entityType === 'airport' || entityType === 'church' || entityType === 'municipal') && (
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address..."
                className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
              />
            </div>
          )}

          {/* Phone (for cemetery, golf_course, hospital, airport, church, municipal) */}
          {(entityType === 'cemetery' || entityType === 'golf_course' || entityType === 'hospital' || entityType === 'airport' || entityType === 'church' || entityType === 'municipal') && (
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
              />
            </div>
          )}

          {/* County Dropdown (for park) */}
          {entityType === 'park' && (
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                County
              </label>
              <select
                value={countyId}
                onChange={(e) => setCountyId(e.target.value)}
                className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
              >
                <option value="">Select a county...</option>
                {counties.map((county) => (
                  <option key={county.id} value={county.id}>
                    {county.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* School Type */}
          {entityType === 'school' && (
            <>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  School Type
                </label>
                <select
                  value={schoolType}
                  onChange={(e) => setSchoolType(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
                >
                  <option value="">Select type...</option>
                  {schoolTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-3 h-3 bg-white/10 border-white/30 rounded focus:ring-white/30 accent-white"
                />
                <label htmlFor="isPublic" className="text-xs text-white/80">
                  Public School
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  School District
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g., Minneapolis Public Schools"
                  className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                />
              </div>
            </>
          )}

          {/* Park Type */}
          {entityType === 'park' && (
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Park Type
              </label>
              <select
                value={parkType}
                onChange={(e) => setParkType(e.target.value)}
                className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
              >
                <option value="">Select type...</option>
                {parkTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Hospital Type */}
          {entityType === 'hospital' && (
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Hospital Type
              </label>
              <select
                value={hospitalType}
                onChange={(e) => setHospitalType(e.target.value)}
                className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
              >
                <option value="">Select type...</option>
                {hospitalTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Golf Course Type */}
          {entityType === 'golf_course' && (
            <>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Course Type
                </label>
                <select
                  value={courseType}
                  onChange={(e) => setCourseType(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
                >
                  <option value="">Select type...</option>
                  {golfCourseTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Number of Holes
                </label>
                <select
                  value={holes}
                  onChange={(e) => setHoles(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
                >
                  <option value="">Select...</option>
                  <option value="9">9 holes</option>
                  <option value="18">18 holes</option>
                  <option value="27">27 holes</option>
                  <option value="36">36 holes</option>
                </select>
              </div>
            </>
          )}

          {/* Airport Type */}
          {entityType === 'airport' && (
            <>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Airport Type
                </label>
                <select
                  value={airportType}
                  onChange={(e) => setAirportType(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
                >
                  <option value="">Select type...</option>
                  {airportTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    IATA Code
                  </label>
                  <input
                    type="text"
                    value={iataCode}
                    onChange={(e) => setIataCode(e.target.value.toUpperCase())}
                    placeholder="MSP"
                    maxLength={3}
                    className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    ICAO Code
                  </label>
                  <input
                    type="text"
                    value={icaoCode}
                    onChange={(e) => setIcaoCode(e.target.value.toUpperCase())}
                    placeholder="KMSP"
                    maxLength={4}
                    className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                  />
                </div>
              </div>
            </>
          )}

          {/* Church Type */}
          {entityType === 'church' && (
            <>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Church Type
                </label>
                <select
                  value={churchType}
                  onChange={(e) => setChurchType(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
                >
                  <option value="">Select type...</option>
                  {churchTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Denomination
                </label>
                <input
                  type="text"
                  value={denomination}
                  onChange={(e) => setDenomination(e.target.value)}
                  placeholder="e.g., Roman Catholic, United Methodist"
                  className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                />
              </div>
            </>
          )}

          {/* Municipal Type */}
          {entityType === 'municipal' && (
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Municipal Type
              </label>
              <select
                value={municipalType}
                onChange={(e) => setMunicipalType(e.target.value)}
                className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
              >
                <option value="">Select type...</option>
                {municipalTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Road Fields */}
          {entityType === 'road' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Road Type
                  </label>
                  <select
                    value={roadType}
                    onChange={(e) => setRoadType(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
                  >
                    <option value="">Select type...</option>
                    {roadTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Route Number
                  </label>
                  <input
                    type="text"
                    value={routeNumber}
                    onChange={(e) => setRouteNumber(e.target.value)}
                    placeholder="e.g., 35, 61, 494"
                    className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Direction
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
                  >
                    <option value="">Select direction...</option>
                    {roadDirections.map((dir) => (
                      <option key={dir.value} value={dir.value}>
                        {dir.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Mile Marker
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={mileMarker}
                    onChange={(e) => setMileMarker(e.target.value)}
                    placeholder="e.g., 42.5"
                    className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Segment Name
                </label>
                <input
                  type="text"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  placeholder="e.g., I-35 through downtown Minneapolis"
                  className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Start Point
                  </label>
                  <input
                    type="text"
                    value={startPoint}
                    onChange={(e) => setStartPoint(e.target.value)}
                    placeholder="e.g., Junction with Hwy 7"
                    className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    End Point
                  </label>
                  <input
                    type="text"
                    value={endPoint}
                    onChange={(e) => setEndPoint(e.target.value)}
                    placeholder="e.g., Wisconsin border"
                    className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Wikipedia URL
                </label>
                <input
                  type="url"
                  value={wikipediaUrl}
                  onChange={(e) => setWikipediaUrl(e.target.value)}
                  placeholder="https://en.wikipedia.org/wiki/..."
                  className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                />
              </div>
            </>
          )}

          {/* Radio & News Fields */}
          {entityType === 'radio_and_news' && (
            <>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Media Type *
                </label>
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
                  required
                >
                  <option value="">Select type...</option>
                  {mediaTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Call Sign
                  </label>
                  <input
                    type="text"
                    value={callSign}
                    onChange={(e) => setCallSign(e.target.value.toUpperCase())}
                    placeholder="e.g., WCCO, KARE"
                    className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Frequency/Channel
                  </label>
                  <input
                    type="text"
                    value={mediaType === 'television' ? channelNumber : frequency}
                    onChange={(e) => mediaType === 'television' ? setChannelNumber(e.target.value) : setFrequency(e.target.value)}
                    placeholder={mediaType === 'television' ? 'e.g., 11' : 'e.g., 830 AM, 102.1 FM'}
                    className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Format/Genre
                </label>
                <input
                  type="text"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  placeholder="e.g., News/Talk, Country, Classical"
                  className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                />
              </div>
              {mediaType === 'television' && (
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Network Affiliation
                  </label>
                  <select
                    value={networkAffiliation}
                    onChange={(e) => setNetworkAffiliation(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30 [&>option]:bg-gray-900 [&>option]:text-white"
                  >
                    <option value="">Select network...</option>
                    {tvNetworkAffiliations.map((network) => (
                      <option key={network.value} value={network.value}>
                        {network.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Parent Company
                </label>
                <input
                  type="text"
                  value={parentCompany}
                  onChange={(e) => setParentCompany(e.target.value)}
                  placeholder="e.g., iHeartMedia, TEGNA"
                  className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address..."
                  className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Wikipedia URL
                </label>
                <input
                  type="url"
                  value={wikipediaUrl}
                  onChange={(e) => setWikipediaUrl(e.target.value)}
                  placeholder="https://en.wikipedia.org/wiki/..."
                  className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
                />
              </div>
            </>
          )}

          {/* Website URL (not for lake, road, or radio_and_news - these have their own URL fields) */}
          {entityType !== 'lake' && entityType !== 'road' && entityType !== 'radio_and_news' && (
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Website URL
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-2 py-1.5 text-xs text-white placeholder-white/40 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-1 focus:ring-white/30"
              />
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-xs font-medium text-white bg-white/20 hover:bg-white/30 disabled:bg-white/10 disabled:text-white/50 border border-white/20 rounded-md transition-colors"
            >
              {isSubmitting 
                ? (isEditMode ? 'Saving...' : 'Creating...') 
                : (isEditMode ? 'Save Changes' : `Create ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`)
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


