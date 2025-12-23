'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export interface AtlasLayer {
  id: string;
  name: string;
  icon: string;
  visible: boolean;
  count?: number;
}

interface MapLayersPanelProps {
  layers: AtlasLayer[];
  onToggleLayer: (layerId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function MapLayersPanel({
  layers,
  onToggleLayer,
  isCollapsed = false,
  onToggleCollapse,
}: MapLayersPanelProps) {
  const visibleCount = layers.filter(l => l.visible).length;

  return (
    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-900">Atlas Layers</span>
          <span className="text-[10px] text-gray-500">({visibleCount}/{layers.length})</span>
        </div>
        {isCollapsed ? (
          <ChevronDownIcon className="w-3 h-3 text-gray-500" />
        ) : (
          <ChevronUpIcon className="w-3 h-3 text-gray-500" />
        )}
      </button>

      {/* Layer List */}
      {!isCollapsed && (
        <div className="border-t border-gray-200">
          {layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => onToggleLayer(layer.id)}
              className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs">{layer.icon}</span>
                <span className="text-xs text-gray-900">{layer.name}</span>
                {layer.count !== undefined && (
                  <span className="text-[10px] text-gray-500">({layer.count})</span>
                )}
              </div>
              {layer.visible ? (
                <EyeIcon className="w-3 h-3 text-gray-700" />
              ) : (
                <EyeSlashIcon className="w-3 h-3 text-gray-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Hook for managing atlas layers state
export function useAtlasLayers() {
  const [layers, setLayers] = useState<AtlasLayer[]>([
    { id: 'cities', name: 'Cities', icon: '🏙️', visible: false },
    { id: 'counties', name: 'Counties', icon: '🗺️', visible: false },
    { id: 'neighborhoods', name: 'Neighborhoods', icon: '🏘️', visible: false },
    { id: 'schools', name: 'Schools', icon: '🎓', visible: false },
    { id: 'parks', name: 'Parks', icon: '🌳', visible: false },
    { id: 'lakes', name: 'Lakes', icon: '💧', visible: false },
    { id: 'watertowers', name: 'Watertowers', icon: '🗼', visible: false },
    { id: 'cemeteries', name: 'Cemeteries', icon: '🪦', visible: false },
    { id: 'golf_courses', name: 'Golf Courses', icon: '⛳', visible: false },
    { id: 'hospitals', name: 'Hospitals', icon: '🏥', visible: false },
    { id: 'airports', name: 'Airports', icon: '✈️', visible: false },
    { id: 'churches', name: 'Churches', icon: '⛪', visible: false },
    { id: 'municipals', name: 'Municipals', icon: '🏛️', visible: false },
    { id: 'roads', name: 'Roads', icon: '🛣️', visible: false },
    { id: 'radio_and_news', name: 'Radio & News', icon: '📻', visible: false },
  ]);

  const toggleLayer = (layerId: string) => {
    setLayers(prev =>
      prev.map(layer =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  const setLayerCount = (layerId: string, count: number) => {
    setLayers(prev =>
      prev.map(layer =>
        layer.id === layerId ? { ...layer, count } : layer
      )
    );
  };

  const getVisibleLayers = () => layers.filter(l => l.visible).map(l => l.id);

  return {
    layers,
    toggleLayer,
    setLayerCount,
    getVisibleLayers,
  };
}


