'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  createNeighborhood,
  createSchool,
  createPark,
  createLake,
  getCities,
  getCounties,
  generateSlug,
  type AtlasEntityType,
} from '@/features/atlas/services/atlasService';

interface CreateAtlasEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: AtlasEntityType;
  coordinates?: { lat: number; lng: number };
  featureName?: string;
  cityName?: string;
  countyName?: string;
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
    title: 'Create Neighborhood',
    nameLabel: 'Neighborhood Name',
    namePlaceholder: 'e.g., Uptown, North Loop',
  },
  school: {
    title: 'Create School',
    nameLabel: 'School Name',
    namePlaceholder: 'e.g., Minneapolis South High School',
  },
  park: {
    title: 'Create Park',
    nameLabel: 'Park Name',
    namePlaceholder: 'e.g., Minnehaha Falls Park',
  },
  lake: {
    title: 'Create Lake',
    nameLabel: 'Lake Name',
    namePlaceholder: 'e.g., Lake Harriet',
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

export default function CreateAtlasEntityModal({
  isOpen,
  onClose,
  entityType,
  coordinates,
  featureName,
  cityName,
  countyName,
  onSuccess,
}: CreateAtlasEntityModalProps) {
  const [name, setName] = useState(featureName || '');
  const [description, setDescription] = useState('');
  const [cityId, setCityId] = useState<string>('');
  const [countyId, setCountyId] = useState<string>('');
  const [schoolType, setSchoolType] = useState<string>('');
  const [isPublic, setIsPublic] = useState(true);
  const [district, setDistrict] = useState('');
  const [parkType, setParkType] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [citiesLoaded, setCitiesLoaded] = useState(false);
  const [countiesLoaded, setCountiesLoaded] = useState(false);

  const config = entityConfig[entityType];

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

  // Auto-select city when cities are loaded and cityName is provided
  useEffect(() => {
    if (citiesLoaded && cityName && cities.length > 0) {
      const normalizedCityName = cityName.toLowerCase().trim();
      const matchedCity = cities.find(
        (city) => city.name.toLowerCase().trim() === normalizedCityName
      );
      if (matchedCity) {
        setCityId(matchedCity.id);
      }
    }
  }, [citiesLoaded, cityName, cities]);

  // Auto-select county when counties are loaded and countyName is provided
  useEffect(() => {
    if (countiesLoaded && countyName && counties.length > 0) {
      const normalizedCountyName = countyName.toLowerCase().trim().replace(' county', '');
      const matchedCounty = counties.find(
        (county) => county.name.toLowerCase().trim().replace(' county', '') === normalizedCountyName
      );
      if (matchedCounty) {
        setCountyId(matchedCounty.id);
      }
    }
  }, [countiesLoaded, countyName, counties]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(featureName || '');
      setDescription('');
      setCityId('');
      setCountyId('');
      setSchoolType('');
      setIsPublic(true);
      setDistrict('');
      setParkType('');
      setWebsiteUrl('');
      setError(null);
      setCitiesLoaded(false);
      setCountiesLoaded(false);
    }
  }, [isOpen, featureName]);

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
        lat: coordinates?.lat,
        lng: coordinates?.lng,
        description: description.trim() || null,
        website_url: websiteUrl.trim() || null,
      };

      switch (entityType) {
        case 'neighborhood':
          await createNeighborhood({
            ...baseData,
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
            lat: coordinates?.lat,
            lng: coordinates?.lng,
          });
          break;
      }

      // Refresh the corresponding atlas layer on the map (autoEnable for new entities)
      const layerIdMap: Record<AtlasEntityType, string> = {
        neighborhood: 'neighborhoods',
        school: 'schools',
        park: 'parks',
        lake: 'lakes',
      };
      window.dispatchEvent(new CustomEvent('atlas-layer-refresh', {
        detail: { layerId: layerIdMap[entityType], autoEnable: true }
      }));

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error creating entity:', err);
      setError(err.message || 'Failed to create. Please try again.');
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
          <h2 className="text-sm font-semibold text-white">{config.title}</h2>
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
          {coordinates && (
            <div className="px-2 py-1.5 bg-white/5 rounded-md border border-white/10">
              <div className="text-[10px] text-white/50">
                Lat: {coordinates.lat.toFixed(6)}, Lng: {coordinates.lng.toFixed(6)}
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

          {/* City Dropdown (for neighborhood, school, park) */}
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

          {/* Website URL (not for lake) */}
          {entityType !== 'lake' && (
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
              {isSubmitting ? 'Creating...' : `Create ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

