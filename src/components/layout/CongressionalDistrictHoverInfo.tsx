'use client';

import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { UserIcon } from '@heroicons/react/24/outline';
import type { CivicPerson } from '@/features/civic/services/civicService';

interface CongressionalDistrictHoverInfoProps {
  district: any | null;
}

/**
 * Right-side floating container showing congressional district info on hover
 */
export default function CongressionalDistrictHoverInfo({
  district,
}: CongressionalDistrictHoverInfoProps) {
  const supabase = useSupabaseClient();
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });
  const [people, setPeople] = useState<CivicPerson[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);

  // Listen for blur style and map style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };
    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
    };
  }, []);

  // Use transparent backgrounds and white text when satellite + blur
  const useTransparentUI = useBlurStyle && currentMapStyle === 'satellite';
  const useWhiteText = useTransparentUI;

  // Extract district numbers from hovered feature and fetch people
  useEffect(() => {
    async function fetchPeople() {
      if (!district?.hoveredFeature?.properties) {
        setPeople([]);
        return;
      }

      const props = district.hoveredFeature.properties;
      const senDist = props.MNSenDist;
      const legDist = props.MNLegDist;

      if (!senDist && !legDist) {
        setPeople([]);
        return;
      }

      setLoadingPeople(true);
      try {
        const districts: string[] = [];
        
        // Add Senate district (format: SD##)
        if (senDist) {
          const senNum = String(senDist).padStart(2, '0');
          districts.push(`SD${senNum}`);
        }
        
        // Add House district (format: HD##A or HD##B)
        if (legDist) {
          districts.push(`HD${legDist}`);
        }

        if (districts.length === 0) {
          setPeople([]);
          return;
        }

        // Query people for these districts
        const { data, error } = await (supabase as any)
          .schema('civic')
          .from('people')
          .select('id, name, slug, party, photo_url, district, email, phone, address, title, building_id, created_at')
          .in('district', districts)
          .order('district');

        if (error) {
          console.error('[CongressionalDistrictHoverInfo] Error fetching people:', error);
          setPeople([]);
        } else {
          setPeople((data || []) as CivicPerson[]);
        }
      } catch (err) {
        console.error('[CongressionalDistrictHoverInfo] Unexpected error:', err);
        setPeople([]);
      } finally {
        setLoadingPeople(false);
      }
    }

    fetchPeople();
  }, [district?.hoveredFeature?.properties?.MNSenDist, district?.hoveredFeature?.properties?.MNLegDist, supabase]);

  if (!district) return null;

  const districtColors = [
    '#FF6B6B', // District 1 - Red
    '#4ECDC4', // District 2 - Teal
    '#45B7D1', // District 3 - Blue
    '#96CEB4', // District 4 - Green
    '#FFEAA7', // District 5 - Yellow
    '#DDA15E', // District 6 - Orange
    '#BC6C25', // District 7 - Brown
    '#6C5CE7', // District 8 - Purple
  ];

  const color = districtColors[district.district_number - 1] || '#888888';

  return (
    <div className={`absolute bottom-3 right-3 z-10 rounded-md shadow-lg p-3 max-w-sm max-h-[60vh] overflow-y-auto ${
      useTransparentUI
        ? 'bg-transparent backdrop-blur-md border border-white/20'
        : useBlurStyle
        ? 'bg-white/90 backdrop-blur-md border border-white/20'
        : 'bg-white border border-gray-200'
    }`}>
      <div className="space-y-2">
        {/* District Header */}
        <div className={`flex items-center gap-2 pb-2 border-b ${
          useTransparentUI ? 'border-white/20' : 'border-gray-200'
        }`}>
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <h3 className={`text-sm font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
            Congressional District {district.district_number}
          </h3>
        </div>

        {/* Precinct/Feature Data */}
        {district.hoveredFeature?.properties && (
          <div className="space-y-1.5">
            <h4 className={`text-xs font-semibold uppercase tracking-wide ${
              useWhiteText ? 'text-white/90' : 'text-gray-900'
            }`}>
              Precinct Data
            </h4>
            <div className="space-y-1 text-xs">
              {Object.entries(district.hoveredFeature.properties).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className={`font-medium min-w-[100px] ${
                    useWhiteText ? 'text-white/70' : 'text-gray-600'
                  }`}>
                    {key}:
                  </span>
                  <span className={`break-words ${
                    useWhiteText ? 'text-white' : 'text-gray-900'
                  }`}>
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* District Metadata */}
        <div className={`pt-2 border-t space-y-1 text-xs ${
          useTransparentUI
            ? 'border-white/20'
            : useBlurStyle
            ? 'border-white/20'
            : 'border-gray-200'
        }`}>
          {district.name && (
            <p className={useWhiteText ? 'text-white/80' : 'text-gray-500'}>
              <span className="font-medium">Name:</span> {district.name}
            </p>
          )}
          {district.description && (
            <p className={useWhiteText ? 'text-white/80' : 'text-gray-500'}>
              <span className="font-medium">Description:</span> {district.description}
            </p>
          )}
          {district.publisher && (
            <p className={useWhiteText ? 'text-white/80' : 'text-gray-500'}>
              <span className="font-medium">Publisher:</span> {district.publisher}
            </p>
          )}
          {district.date && (
            <p className={useWhiteText ? 'text-white/80' : 'text-gray-500'}>
              <span className="font-medium">Date:</span> {district.date}
            </p>
          )}
          {district.geometry?.features && (
            <p className={useWhiteText ? 'text-white/80' : 'text-gray-500'}>
              <span className="font-medium">Total Precincts:</span> {district.geometry.features.length}
            </p>
          )}
        </div>

        {/* People Section */}
        {district.hoveredFeature?.properties && (
          <div className={`pt-2 border-t space-y-2 ${
            useTransparentUI
              ? 'border-white/20'
              : useBlurStyle
              ? 'border-white/20'
              : 'border-gray-200'
          }`}>
            <h4 className={`text-xs font-semibold uppercase tracking-wide ${
              useWhiteText ? 'text-white/90' : 'text-gray-900'
            }`}>
              Representatives
            </h4>
            
            {loadingPeople ? (
              <div className="flex items-center justify-center py-2">
                <div className={`w-3 h-3 border-2 rounded-full animate-spin ${
                  useWhiteText 
                    ? 'border-white/30 border-t-white' 
                    : 'border-gray-300 border-t-gray-600'
                }`} />
              </div>
            ) : people.length > 0 ? (
              <div className="space-y-1.5">
                {people.map((person) => (
                  <div
                    key={person.id}
                    className={`flex items-start gap-1.5 p-1.5 rounded ${
                      useTransparentUI
                        ? 'bg-white/10'
                        : useBlurStyle
                        ? 'bg-white/50'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      useTransparentUI ? 'bg-white/20' : 'bg-gray-100'
                    }`}>
                      {person.photo_url ? (
                        <img
                          src={person.photo_url}
                          alt={person.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <UserIcon className={`w-3 h-3 ${
                          useWhiteText ? 'text-white/70' : 'text-gray-500'
                        }`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium truncate ${
                        useWhiteText ? 'text-white' : 'text-gray-900'
                      }`}>
                        {person.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {person.district && (
                          <span className={`text-xs ${
                            useWhiteText ? 'text-white/70' : 'text-gray-600'
                          }`}>
                            {person.district}
                          </span>
                        )}
                        {person.party && (
                          <span
                            className={`px-1 py-0.5 rounded text-[10px] font-medium ${
                              person.party === 'R'
                                ? 'bg-red-100 text-red-700'
                                : person.party === 'DFL'
                                ? 'bg-blue-100 text-blue-700'
                                : useTransparentUI
                                ? 'bg-white/20 text-white/80'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {person.party}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-xs ${
                useWhiteText ? 'text-white/60' : 'text-gray-500'
              }`}>
                No representatives found for this precinct
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

