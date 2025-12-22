'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { generateMapStaticImageUrl } from '../utils/mapStaticImage';

interface PostMapRendererProps {
  mapData: { 
    type: 'pin' | 'area' | 'both'; 
    geometry: GeoJSON.Point | GeoJSON.Polygon | GeoJSON.MultiPolygon;
    radius?: number;
    center?: [number, number];
    showRadius?: boolean;
    screenshot?: string; // Base64 PNG or URL
    polygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon; // For 'both' type
  };
  height?: string;
  className?: string;
  onClick?: () => void; // Optional click handler to open full map view
}

export default function PostMapRenderer({
  mapData,
  height = '300px',
  className = '',
  onClick,
}: PostMapRendererProps) {
  const [imageError, setImageError] = useState(false);
  
  // Prefer screenshot if available (captured from map), otherwise use static image
  const imageUrl = useMemo(() => {
    if (mapData.screenshot) {
      return mapData.screenshot;
    }
    if (imageError) return null;
    return generateMapStaticImageUrl(mapData, {
      width: 600,
      height: 300,
    });
  }, [mapData, imageError]);

  // Parse height to get numeric value for aspect ratio
  const heightValue = useMemo(() => {
    const match = height.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 300;
  }, [height]);

  // Map type label
  const mapTypeLabel = useMemo(() => {
    if (mapData.type === 'pin') return 'Pin';
    if (mapData.type === 'both') return 'Pin + Area';
    return 'Area';
  }, [mapData.type]);

  if (!imageUrl) {
    // Fallback if image generation fails
    return (
      <div 
        className={`relative border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 shadow-sm ${onClick ? 'cursor-pointer hover:border-gray-300 transition-colors' : ''} ${className}`} 
        style={{ height }}
        onClick={onClick}
      >
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <MapPinIcon className="w-6 h-6 text-gold-600" />
            <span className="text-sm font-medium">Map preview unavailable</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 shadow-sm group ${onClick ? 'cursor-pointer hover:border-gold-400 hover:shadow-md transition-all' : ''} ${className}`} 
      style={{ height }}
      onClick={onClick}
    >
      <Image
        src={imageUrl}
        alt={`Map ${mapTypeLabel.toLowerCase()}`}
        fill
        className={height === '100%' ? 'object-contain' : 'object-cover'}
        sizes="(max-width: 768px) 100vw, 600px"
        onError={() => setImageError(true)}
        unoptimized={mapData.screenshot?.startsWith('data:')} // Only unoptimized for base64 screenshots
      />
      
      {/* Overlay with map type indicator */}
      <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5">
        <MapPinIcon className="w-3.5 h-3.5" />
        <span>{mapTypeLabel}</span>
        {onClick && (
          <span className="text-gold-400 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Click to view
          </span>
        )}
      </div>
    </div>
  );
}

