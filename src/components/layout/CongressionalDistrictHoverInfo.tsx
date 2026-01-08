'use client';

import { useState, useEffect } from 'react';

interface CongressionalDistrictHoverInfoProps {
  district: any | null;
}

/**
 * Right-side floating container showing congressional district info on hover
 */
export default function CongressionalDistrictHoverInfo({
  district,
}: CongressionalDistrictHoverInfoProps) {
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

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
      </div>
    </div>
  );
}

