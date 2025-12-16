'use client';

import { useState, useEffect } from 'react';
import { Area, AreaService, CreateAreaData } from '@/features/areas/services/areaService';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useProfile } from '@/features/profiles/contexts/ProfileContext';
import { useToast } from '@/features/ui/hooks/useToast';

interface CompactAreaFormProps {
  onStartDrawing: () => void;
  polygonCoordinates?: Array<[number, number]>;
  isActivelyDrawing?: boolean;
  hasDrawnPolygon?: boolean;
  editingAreaShape?: Area | null;
  drawnGeometry?: GeoJSON.Geometry | null;
  onSave?: () => Promise<void>;
  onCancel?: () => void;
}

export function CompactAreaForm({ 
  onStartDrawing, 
  polygonCoordinates = [],
  isActivelyDrawing = false,
  hasDrawnPolygon = false,
  editingAreaShape = null,
  drawnGeometry = null,
  onSave,
  onCancel,
}: CompactAreaFormProps) {
  const { selectedProfile } = useProfile();
  const { success, error } = useToast();
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset name when starting a new area
  useEffect(() => {
    if (hasDrawnPolygon && !isActivelyDrawing && !editingAreaShape) {
      setName('');
    }
  }, [hasDrawnPolygon, isActivelyDrawing, editingAreaShape]);

  // Set name from editing area
  useEffect(() => {
    if (editingAreaShape) {
      setName(editingAreaShape.name);
    }
  }, [editingAreaShape]);
  // Determine current state
  const getState = (): string => {
    if (editingAreaShape) return 'Editing';
    if (isActivelyDrawing) return 'Drawing';
    if (hasDrawnPolygon || polygonCoordinates.length > 0) return 'Drawn';
    return 'Idle';
  };

  const currentState = getState();
  
  // Get coordinates from editing area if available
  const getCoordinatesFromArea = (area: Area | null): Array<[number, number]> => {
    if (!area) return [];
    
    if (area.geometry.type === 'Polygon' && area.geometry.coordinates[0]) {
      return area.geometry.coordinates[0] as Array<[number, number]>;
    }
    
    if (area.geometry.type === 'MultiPolygon' && area.geometry.coordinates[0]?.[0]) {
      // For MultiPolygon, use the first polygon
      return area.geometry.coordinates[0][0] as Array<[number, number]>;
    }
    
    return [];
  };
  
  const displayCoordinates = editingAreaShape 
    ? getCoordinatesFromArea(editingAreaShape)
    : polygonCoordinates;

  // State badge colors
  const getStateColor = (state: string) => {
    switch (state) {
      case 'Drawing':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Drawn':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'Editing':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-2.5">
      {/* State Badge */}
      <div className="flex items-center justify-between">
        <div className={`px-2 py-1 rounded text-[10px] font-medium border ${getStateColor(currentState)}`}>
          {currentState}
        </div>
        {!isActivelyDrawing && !editingAreaShape && (
          <button
            onClick={onStartDrawing}
            className="h-7 px-3 rounded-lg bg-gold-500/90 hover:bg-gold-500 text-black text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>Start Drawing</span>
          </button>
        )}
      </div>

      {/* Instructions when idle */}
      {currentState === 'Idle' && (
        <div className="px-2.5 py-2 rounded-lg bg-white/10 border border-white/20">
          <p className="text-[11px] text-gray-900 leading-tight">
            Click on the map to start drawing an area. Press <kbd className="px-1 py-0.5 bg-white/20 rounded text-[9px] font-mono">Enter</kbd> to complete.
          </p>
        </div>
      )}

      {/* Coordinates List */}
      {displayCoordinates.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-gray-900 font-medium">
              Points: {displayCoordinates.length}
            </p>
          </div>
          <div className="max-h-[200px] overflow-y-auto scrollbar-hide space-y-1">
            {displayCoordinates
              .filter((coord) => coord && Array.isArray(coord) && coord.length >= 2 && coord[0] != null && coord[1] != null)
              .map((coord, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-gray-900 text-[10px] font-mono bg-white/10 rounded px-2 py-1 border border-white/20"
                >
                  <span className="text-gray-600 font-normal flex-shrink-0">{index + 1}.</span>
                  <span className="truncate">Lat: {coord[1].toFixed(6)}, Lng: {coord[0].toFixed(6)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Name Input - Show when polygon is drawn or editing */}
      {((hasDrawnPolygon && !isActivelyDrawing) || editingAreaShape) && (
        <div className="space-y-1.5 pt-2 border-t border-white/20">
          <label className="text-[11px] text-gray-900 font-medium block">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter area name"
            className="w-full px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 text-[11px] text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 transition-all"
            disabled={isSaving}
            autoFocus
          />
        </div>
      )}

      {/* Save/Cancel Buttons - Show when polygon is drawn or editing */}
      {((hasDrawnPolygon && !isActivelyDrawing) || editingAreaShape) && onSave && onCancel && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-gray-900 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <XMarkIcon className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!name.trim()) {
                error('Name Required', 'Please enter a name for your area');
                return;
              }

              if (editingAreaShape) {
                // For editing, we need to get the current geometry from drawRef
                // This is handled by the parent's handleSaveArea
                // Just call onSave which will trigger handleSaveArea
                if (onSave) {
                  await onSave();
                }
                return;
              }

              // For new area, create it here
              if (!drawnGeometry) {
                error('Geometry Required', 'Please complete drawing the area first');
                return;
              }

              if (!selectedProfile) {
                error('Profile Required', 'Please select a profile to save this area');
                return;
              }

              setIsSaving(true);
              try {
                const data: CreateAreaData = {
                  name: name.trim(),
                  description: null,
                  visibility: 'public',
                  category: 'custom',
                  geometry: drawnGeometry,
                };

                await AreaService.createArea(data, selectedProfile.id);
                success('Area Saved', 'Your area has been saved successfully');
                
                if (onSave) {
                  await onSave();
                }
              } catch (err) {
                console.error('Error saving area:', err);
                error('Save Failed', err instanceof Error ? err.message : 'Failed to save area');
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={!name.trim() || isSaving || (!editingAreaShape && (!drawnGeometry || !selectedProfile))}
            className="flex-1 px-3 py-2 bg-gold-500/90 hover:bg-gold-500 text-black rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <div className="w-3 h-3 border border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                {editingAreaShape ? 'Save Changes' : 'Save Area'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

