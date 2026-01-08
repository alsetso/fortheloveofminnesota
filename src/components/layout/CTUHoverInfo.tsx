'use client';

import { useState, useEffect } from 'react';

interface CTUHoverInfoProps {
  ctu: any | null;
}

/**
 * Right-side floating container showing CTU (City, Township, Unorganized Territory) info on hover
 */
export default function CTUHoverInfo({
  ctu,
}: CTUHoverInfoProps) {
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

  if (!ctu) return null;

  // Color scheme by CTU class
  const colorMap = {
    'CITY': '#4A90E2',           // Blue
    'TOWNSHIP': '#7ED321',       // Green
    'UNORGANIZED TERRITORY': '#F5A623', // Orange
  };

  const color = colorMap[ctu.ctu_class as keyof typeof colorMap] || '#888888';

  // Format CTU class name
  const formatCTUClass = (ctuClass: string) => {
    if (ctuClass === 'UNORGANIZED TERRITORY') {
      return 'Unorganized Territory';
    }
    return ctuClass.charAt(0) + ctuClass.slice(1).toLowerCase();
  };

  return (
    <div className={`absolute bottom-3 right-3 z-10 rounded-md shadow-lg p-3 max-w-sm max-h-[60vh] overflow-y-auto ${
      useTransparentUI
        ? 'bg-transparent backdrop-blur-md border border-white/20'
        : useBlurStyle
        ? 'bg-white/90 backdrop-blur-md border border-white/20'
        : 'bg-white border border-gray-200'
    }`}>
      <div className="space-y-2">
        {/* CTU Header */}
        <div className={`flex items-center gap-2 pb-2 border-b ${
          useTransparentUI ? 'border-white/20' : 'border-gray-200'
        }`}>
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-semibold truncate ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
              {ctu.feature_name}
            </h3>
            <p className={`text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
              {formatCTUClass(ctu.ctu_class)}
            </p>
          </div>
        </div>

        {/* CTU Metadata */}
        <div className={`space-y-1 text-xs ${
          useTransparentUI
            ? 'border-white/20'
            : useBlurStyle
            ? 'border-white/20'
            : 'border-gray-200'
        }`}>
          {ctu.county_name && (
            <p className={useWhiteText ? 'text-white/80' : 'text-gray-600'}>
              <span className="font-medium">County:</span> {ctu.county_name}
            </p>
          )}
          {ctu.population !== null && ctu.population !== undefined && (
            <p className={useWhiteText ? 'text-white/80' : 'text-gray-600'}>
              <span className="font-medium">Population:</span> {ctu.population.toLocaleString()}
            </p>
          )}
          {ctu.acres !== null && ctu.acres !== undefined && (
            <p className={useWhiteText ? 'text-white/80' : 'text-gray-600'}>
              <span className="font-medium">Acres:</span> {ctu.acres.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          )}
          {ctu.gnis_feature_id && (
            <p className={useWhiteText ? 'text-white/80' : 'text-gray-600'}>
              <span className="font-medium">GNIS ID:</span> {ctu.gnis_feature_id}
            </p>
          )}
          {ctu.county_code && (
            <p className={useWhiteText ? 'text-white/80' : 'text-gray-600'}>
              <span className="font-medium">County Code:</span> {ctu.county_code}
            </p>
          )}
        </div>

        {/* Feature Properties (if available) */}
        {ctu.hoveredFeature?.properties && Object.keys(ctu.hoveredFeature.properties).length > 0 && (
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
              {Object.entries(ctu.hoveredFeature.properties)
                .filter(([key]) => !['ctu_id', 'ctu_class', 'feature_name', 'gnis_feature_id', 'county_name', 'county_code', 'population', 'acres'].includes(key))
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

