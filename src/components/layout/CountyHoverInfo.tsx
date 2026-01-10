'use client';

import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

interface CountyHoverInfoProps {
  county: any | null;
}

/**
 * Right-side floating container showing county info on hover
 */
export default function CountyHoverInfo({
  county,
}: CountyHoverInfoProps) {
  const supabase = useSupabaseClient();
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });
  const [atlasCounty, setAtlasCounty] = useState<any | null>(null);
  const [loadingAtlas, setLoadingAtlas] = useState(false);

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

  // Fetch atlas county data if county_id is available
  useEffect(() => {
    async function fetchAtlasCounty() {
      if (!county?.county_id) {
        setAtlasCounty(null);
        return;
      }

      setLoadingAtlas(true);
      try {
        // Type assertion needed: Supabase TypeScript types only support 'public' schema,
        // but we need to query from 'atlas' schema. The schema() method exists at runtime.
        const { data, error } = await (supabase as any)
          .schema('atlas')
          .from('counties')
          .select('id, name, slug, population, area_sq_mi, lat, lng')
          .eq('id', county.county_id)
          .single();

        if (error) {
          console.error('[CountyHoverInfo] Error fetching atlas county:', error);
          setAtlasCounty(null);
        } else {
          setAtlasCounty(data);
        }
      } catch (err) {
        console.error('[CountyHoverInfo] Unexpected error:', err);
        setAtlasCounty(null);
      } finally {
        setLoadingAtlas(false);
      }
    }

    fetchAtlasCounty();
  }, [county?.county_id, supabase]);

  // Use transparent backgrounds and white text when satellite + blur
  const useTransparentUI = useBlurStyle && currentMapStyle === 'satellite';
  const useWhiteText = useTransparentUI;

  if (!county) return null;

  return (
    <div className={`absolute bottom-3 right-3 z-10 rounded-md shadow-lg p-3 max-w-sm max-h-[60vh] overflow-y-auto ${
      useTransparentUI
        ? 'bg-transparent backdrop-blur-md border border-white/20'
        : useBlurStyle
        ? 'bg-white/90 backdrop-blur-md border border-white/20'
        : 'bg-white border border-gray-200'
    }`}>
      <div className="space-y-2">
        {/* County Header */}
        <div className={`flex items-center gap-2 pb-2 border-b ${
          useTransparentUI ? 'border-white/20' : 'border-gray-200'
        }`}>
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: '#7ED321' }}
          />
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-semibold truncate ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
              {county.county_name}
            </h3>
            <p className={`text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
              County
            </p>
          </div>
        </div>

        {/* County Metadata */}
        <div className={`space-y-1 text-xs ${
          useTransparentUI
            ? 'border-white/20'
            : useBlurStyle
            ? 'border-white/20'
            : 'border-gray-200'
        }`}>
          {county.county_code && (
            <p className={useWhiteText ? 'text-white/80' : 'text-gray-600'}>
              <span className="font-medium">County Code:</span> {county.county_code}
            </p>
          )}
          {county.county_gnis_feature_id && (
            <p className={useWhiteText ? 'text-white/80' : 'text-gray-600'}>
              <span className="font-medium">GNIS ID:</span> {county.county_gnis_feature_id}
            </p>
          )}
        </div>

        {/* Atlas County Data */}
        {county.county_id && (
          <div className={`pt-2 border-t space-y-1 ${
            useTransparentUI
              ? 'border-white/20'
              : useBlurStyle
              ? 'border-white/20'
              : 'border-gray-200'
          }`}>
            {loadingAtlas ? (
              <div className="flex items-center justify-center py-2">
                <div className={`w-3 h-3 border-2 rounded-full animate-spin ${
                  useWhiteText 
                    ? 'border-white/30 border-t-white' 
                    : 'border-gray-300 border-t-gray-600'
                }`} />
              </div>
            ) : atlasCounty ? (
              <div className="space-y-1 text-xs">
                {atlasCounty.population !== null && atlasCounty.population !== undefined && (
                  <p className={useWhiteText ? 'text-white/80' : 'text-gray-600'}>
                    <span className="font-medium">Population:</span> {atlasCounty.population.toLocaleString()}
                  </p>
                )}
                {atlasCounty.area_sq_mi !== null && atlasCounty.area_sq_mi !== undefined && (
                  <p className={useWhiteText ? 'text-white/80' : 'text-gray-600'}>
                    <span className="font-medium">Area:</span> {atlasCounty.area_sq_mi.toLocaleString(undefined, { maximumFractionDigits: 2 })} sq mi
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Boundary Metadata */}
        {(county.description || county.publisher || county.source_date) && (
          <div className={`pt-2 border-t space-y-1 text-xs ${
            useTransparentUI
              ? 'border-white/20'
              : useBlurStyle
              ? 'border-white/20'
              : 'border-gray-200'
          }`}>
            {county.description && (
              <p className={useWhiteText ? 'text-white/80' : 'text-gray-600'}>
                <span className="font-medium">Description:</span> {county.description}
              </p>
            )}
            {county.publisher && (
              <p className={useWhiteText ? 'text-white/80' : 'text-gray-600'}>
                <span className="font-medium">Publisher:</span> {county.publisher}
              </p>
            )}
            {county.source_date && (
              <p className={useWhiteText ? 'text-white/80' : 'text-gray-600'}>
                <span className="font-medium">Source Date:</span> {new Date(county.source_date).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Feature Properties (if available) */}
        {county.hoveredFeature?.properties && Object.keys(county.hoveredFeature.properties).length > 0 && (
          <div className={`pt-2 border-t space-y-1.5 ${
            useTransparentUI
              ? 'border-white/20'
              : useBlurStyle
              ? 'border-white/20'
              : 'border-gray-200'
          }`}>
            <h4 className={`text-xs font-semibold uppercase tracking-wide ${
              useWhiteText ? 'text-white/90' : 'text-gray-900'
            }`}>
              Feature Data
            </h4>
            <div className="space-y-1 text-xs">
              {Object.entries(county.hoveredFeature.properties)
                .filter(([key]) => !['county_id', 'county_name', 'county_code', 'county_gnis_feature_id'].includes(key))
                .map(([key, value]) => (
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
      </div>
    </div>
  );
}

