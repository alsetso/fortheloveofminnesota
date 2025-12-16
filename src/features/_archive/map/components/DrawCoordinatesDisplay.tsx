'use client';

import { useState } from 'react';
import { HandRaisedIcon, PencilIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Area } from '@/features/areas/services/areaService';

interface DrawCoordinatesDisplayProps {
  coordinates: Array<[number, number]>; // [lng, lat] pairs
  isDrawing: boolean;
  drawMode?: 'draw' | 'pan';
  onDrawModeChange?: (mode: 'draw' | 'pan') => void;
  onEditVertices?: () => void;
  canEditVertices?: boolean;
  areaName?: string | null; // Name of area being edited
  areas?: Area[]; // List of existing areas
  onAreaSelect?: (area: Area) => void; // Callback when area is selected from list
  onAreaDelete?: (area: Area) => void; // Callback when area is deleted from list
}

export function DrawCoordinatesDisplay({ 
  coordinates, 
  isDrawing,
  drawMode = 'draw',
  onDrawModeChange,
  onEditVertices,
  canEditVertices = false,
  areaName,
  areas = [],
  onAreaSelect,
  onAreaDelete
}: DrawCoordinatesDisplayProps) {
  const [isAreasExpanded, setIsAreasExpanded] = useState(false);
  
  // Show simplified view when no coordinates and no areas to show
  if (!isDrawing && coordinates.length === 0 && (!areas.length || !onAreaSelect)) {
    return (
      <div className="pointer-events-auto bg-transparent backdrop-blur-[5px] rounded-2xl p-4 max-w-xs" style={{ backdropFilter: 'blur(5px)' }}>
        <div className="text-white font-semibold text-sm mb-2">Drawing Area</div>
        <p className="text-white/70 text-xs">Click on the map to start drawing a polygon</p>
      </div>
    );
  }

  // Extract coordinates count from areas for display
  const getAreaPointCount = (area: Area): number => {
    if (area.geometry.type === 'Polygon' && area.geometry.coordinates[0]) {
      return area.geometry.coordinates[0].length;
    }
    return 0;
  };

  // Sort areas by name for better UX
  const sortedAreas = [...areas].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="pointer-events-auto w-full max-h-[30rem] overflow-y-auto">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-white font-semibold text-xs">
          {areaName ? `Editing: ${areaName}` : 'Drawing Area'}
        </div>
        {onDrawModeChange && (
          <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5 border border-white/20">
            <button
              onClick={() => onDrawModeChange('draw')}
              className={`px-2 py-1 rounded text-[11px] transition-all flex items-center gap-1 ${
                drawMode === 'draw'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white/80'
              }`}
              title="Click to add points"
            >
              <PencilIcon className="w-3 h-3" />
              Draw
            </button>
            <button
              onClick={() => onDrawModeChange('pan')}
              className={`px-2 py-1 rounded text-[11px] transition-all flex items-center gap-1 ${
                drawMode === 'pan'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white/80'
              }`}
              title="Click and drag to pan/zoom"
            >
              <HandRaisedIcon className="w-3 h-3" />
              Pan
            </button>
          </div>
        )}
      </div>
      
      {drawMode === 'pan' && (
        <div className="mb-2.5 p-2 bg-white/10 rounded-lg border border-white/20">
          <p className="text-white/80 text-[11px]">
            Pan mode: Click and drag to move the map. Switch to &quot;Draw&quot; to add points.
          </p>
        </div>
      )}

      {/* Existing Areas Accordion - Show at top */}
      {sortedAreas.length > 0 && onAreaSelect && (
        <div className="mb-2.5 border-b border-white/20 pb-2.5">
          <button
            onClick={() => setIsAreasExpanded(!isAreasExpanded)}
            className="w-full flex items-center justify-between text-white/90 text-[11px] font-medium hover:text-white transition-colors py-1"
          >
            <span>Existing Areas ({sortedAreas.length})</span>
            {isAreasExpanded ? (
              <ChevronUpIcon className="w-3.5 h-3.5" />
            ) : (
              <ChevronDownIcon className="w-3.5 h-3.5" />
            )}
          </button>
          
          {isAreasExpanded && (
            <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
              {sortedAreas.map((area) => {
                const pointCount = getAreaPointCount(area);
                return (
                  <div
                    key={area.id}
                    className="w-full p-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => onAreaSelect?.(area)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="text-white text-[11px] font-medium truncate">{area.name}</div>
                        {area.description && (
                          <div className="text-white/60 text-[10px] line-clamp-1 mt-0.5">{area.description}</div>
                        )}
                        <div className="text-white/50 text-[10px] mt-0.5">{pointCount} points</div>
                      </button>
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        <PencilIcon className="w-3.5 h-3.5 text-white/40 group-hover:text-white/60" />
                        {onAreaDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAreaDelete(area);
                            }}
                            className="p-0.5 hover:bg-red-500/20 rounded transition-colors"
                            title="Delete area"
                          >
                            <TrashIcon className="w-3.5 h-3.5 text-red-400 group-hover:text-red-300" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {coordinates.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-white/90 text-[11px] font-medium">
              Points: {coordinates.length} {isDrawing && <span className="text-white/60">(drawing...)</span>}
            </div>
            {canEditVertices && onEditVertices && (
              <button
                onClick={onEditVertices}
                className="px-2 py-0.5 text-[11px] bg-white/10 hover:bg-white/20 text-white rounded transition-all"
                title="Edit vertex positions"
              >
                Edit Vertices
              </button>
            )}
          </div>
          <div className="space-y-1">
            {coordinates
              .filter((coord) => coord && Array.isArray(coord) && coord.length >= 2 && coord[0] != null && coord[1] != null)
              .map((coord, index) => (
                <div
                  key={index}
                  className="flex items-start gap-1.5 text-white/80 text-[10px] font-mono bg-white/5 rounded px-1.5 py-1"
                >
                  <span className="text-white/60 font-normal">{index + 1}.</span>
                  <div className="flex-1">
                    <div>Lat: {coord[1].toFixed(6)}</div>
                    <div>Lng: {coord[0].toFixed(6)}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <p className="text-white/70 text-xs">Click on the map to add points</p>
      )}
    </div>
  );
}

