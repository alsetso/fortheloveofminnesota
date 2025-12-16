'use client';

import { XMarkIcon, MapPinIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { getDataLogEntries, removeDataLogEntry, clearDataLog, type DataLogEntry } from '@/features/_archive/map/utils/dataLogStorage';
import { useState, useEffect } from 'react';
import type { MapFeature } from '@/features/_archive/map/types/featureCollection';

interface DataLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DataLogModal({ isOpen, onClose }: DataLogModalProps) {
  const [entries, setEntries] = useState<DataLogEntry[]>([]);

  useEffect(() => {
    if (isOpen) {
      setEntries(getDataLogEntries());
    }
  }, [isOpen]);

  const handleRemove = (entryId: string) => {
    removeDataLogEntry(entryId);
    const updated = getDataLogEntries();
    setEntries(updated);
    // Trigger custom event to update count in parent
    window.dispatchEvent(new CustomEvent('dataLogUpdated'));
  };

  const handleClearAll = () => {
    if (confirm('Clear all entries from data log?')) {
      clearDataLog();
      setEntries([]);
      // Trigger custom event to update count in parent
      window.dispatchEvent(new CustomEvent('dataLogUpdated'));
    }
  };

  const formatCoordinates = (feature: MapFeature): string => {
    if (feature.geometry.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates;
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } else if (feature.geometry.type === 'Polygon') {
      const firstRing = feature.geometry.coordinates[0];
      return `${firstRing.length} points`;
    } else if (feature.geometry.type === 'MultiPolygon') {
      const totalPoints = feature.geometry.coordinates.reduce(
        (sum, polygon) => sum + polygon[0].length,
        0
      );
      return `${feature.geometry.coordinates.length} polygons, ${totalPoints} points`;
    }
    return 'N/A';
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
        <div
          className="bg-white rounded-md shadow-xl max-w-2xl w-full max-h-[80vh] pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Data Log ({entries.length})
            </h3>
            <div className="flex items-center gap-2">
              {entries.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  aria-label="Clear all"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {entries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-gray-500">No entries in data log</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Create pins or areas and click &quot;Save & Complete&quot; to add them here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-gray-50 border border-gray-200 rounded-md p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {entry.feature.properties.featureType === 'pin' ? (
                            <MapPinIcon className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                          ) : (
                            <PencilIcon className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-gray-900 capitalize">
                            {entry.feature.properties.featureType}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                        
                        <div className="text-[10px] text-gray-600 font-mono mt-1 break-all">
                          {formatCoordinates(entry.feature)}
                        </div>
                        
                        {entry.label && (
                          <div className="text-xs text-gray-700 mt-1">
                            {entry.label}
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => handleRemove(entry.id)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                        aria-label="Remove entry"
                      >
                        <TrashIcon className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

