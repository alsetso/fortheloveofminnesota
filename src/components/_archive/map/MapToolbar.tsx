'use client';

import { useState, useEffect, useRef } from 'react';
import AppSearch from '@/components/app/AppSearch';
import type { MapboxMetadata } from '@/types/mapbox';
import {
  MapIcon,
  Squares2X2Icon,
  GlobeAltIcon,
  ViewfinderCircleIcon,
  CubeIcon,
  ViewColumnsIcon,
  EllipsisVerticalIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import {
  MapIcon as MapIconSolid,
  Squares2X2Icon as Squares2X2IconSolid,
  GlobeAltIcon as GlobeAltIconSolid,
  CubeIcon as CubeIconSolid,
  ViewColumnsIcon as ViewColumnsIconSolid,
} from '@heroicons/react/24/solid';

interface MapToolbarProps {
  className?: string;
  mapStyle?: string;
  onStyleChange?: (style: string) => void;
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string, mapboxMetadata?: MapboxMetadata) => void;
  is3DMode?: boolean;
  on3DToggle?: (is3D: boolean) => void;
  onFindMe?: () => void;
}

const mapStyles = [
  { id: 'streets', label: 'Streets', icon: MapIcon, iconSolid: MapIconSolid },
  { id: 'satellite', label: 'Satellite', icon: GlobeAltIcon, iconSolid: GlobeAltIconSolid },
  { id: 'light', label: 'Light', icon: Squares2X2Icon, iconSolid: Squares2X2IconSolid },
];

export default function MapToolbar({ 
  className = '',
  mapStyle = 'streets',
  onStyleChange,
  onLocationSelect,
  is3DMode = false,
  on3DToggle,
  onFindMe,
}: MapToolbarProps) {
  const [activeStyle, setActiveStyle] = useState(mapStyle);
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync with prop changes
  useEffect(() => {
    setActiveStyle(mapStyle);
  }, [mapStyle]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsStyleDropdownOpen(false);
      }
    };

    if (isStyleDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isStyleDropdownOpen]);

  const handleStyleClick = (styleId: string) => {
    setActiveStyle(styleId);
    onStyleChange?.(styleId);
    setIsStyleDropdownOpen(false);
  };

  const handle3DToggle = () => {
    on3DToggle?.(!is3DMode);
  };

  const currentStyle = mapStyles.find(s => s.id === activeStyle) || mapStyles[0];
  const CurrentIcon = currentStyle.iconSolid;

  return (
    <div className={`bg-white border-b border-gray-200 sticky top-[56px] z-40 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12 gap-4">
          {/* Left: Search */}
          <div className="flex-1 max-w-md">
            <div className="map-toolbar-search">
              <AppSearch 
                placeholder="Search locations..." 
                onLocationSelect={onLocationSelect}
              />
            </div>
            <style jsx global>{`
              .map-toolbar-search form {
                width: 100%;
              }
              .map-toolbar-search input {
                height: 2rem !important;
                font-size: 0.875rem !important;
                padding-left: 2rem !important;
                padding-right: 0.75rem !important;
                background-color: #f3f2ef !important;
                border: 1px solid transparent !important;
                color: #1f2937 !important;
                border-radius: 0.25rem !important;
              }
              .map-toolbar-search input::placeholder {
                color: #6b7280 !important;
              }
              .map-toolbar-search input:focus {
                background-color: white !important;
                border-color: #c2b289 !important;
                outline: none !important;
                box-shadow: 0 0 0 1px #c2b289 !important;
              }
              .map-toolbar-search .absolute.inset-y-0.left-0 {
                padding-left: 0.5rem !important;
              }
              .map-toolbar-search .absolute.inset-y-0.left-0 svg {
                width: 1rem !important;
                height: 1rem !important;
                color: #6b7280 !important;
              }
              .map-toolbar-search .absolute.top-full {
                margin-top: 0.5rem !important;
              }
            `}</style>
          </div>

          {/* Right: Map Tools */}
          <div className="flex items-center gap-1">
            {/* Find Me Button */}
            {onFindMe && (
              <button
                onClick={onFindMe}
                className="
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                  transition-all duration-150
                  text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent
                "
                title="Find My Location"
              >
                <MapPinIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Find Me</span>
              </button>
            )}
            
            {/* 2D/3D Toggle */}
            {on3DToggle && (
              <button
                onClick={handle3DToggle}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                  transition-all duration-150
                  ${is3DMode
                    ? 'bg-gold-100 text-gold-700 border border-gold-300'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
                  }
                `}
                title={is3DMode ? 'Switch to 2D' : 'Switch to 3D'}
              >
                {is3DMode ? (
                  <CubeIconSolid className="w-4 h-4" />
                ) : (
                  <ViewColumnsIcon className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{is3DMode ? '3D' : '2D'}</span>
              </button>
            )}
            
            {/* Map Style Dropdown */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setIsStyleDropdownOpen(!isStyleDropdownOpen)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                  transition-all duration-150
                  ${isStyleDropdownOpen
                    ? 'bg-gold-100 text-gold-700 border border-gold-300'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
                  }
                `}
                title="Map Style"
              >
                <CurrentIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{currentStyle.label}</span>
                <EllipsisVerticalIcon className="w-4 h-4 ml-0.5" />
              </button>

              {/* Dropdown Menu */}
              {isStyleDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[140px]">
                  <div className="py-1">
                    {mapStyles.map((style) => {
                      const Icon = activeStyle === style.id ? style.iconSolid : style.icon;
                      return (
                        <button
                          key={style.id}
                          onClick={() => handleStyleClick(style.id)}
                          className={`
                            w-full flex items-center gap-2 px-3 py-2 text-xs font-medium
                            transition-all duration-150 text-left
                            ${activeStyle === style.id
                              ? 'bg-gold-50 text-gold-700'
                              : 'text-gray-700 hover:bg-gray-50'
                            }
                          `}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{style.label}</span>
                          {activeStyle === style.id && (
                            <span className="ml-auto text-gold-600">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
