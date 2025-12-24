'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

interface AtlasEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  tableName: string;
}

// Icon mapping: table_name -> image path (matches AtlasLayer)
const ICON_MAP: Record<string, string> = {
  cities: '/city.png',
  lakes: '/lakes.png',
  parks: '/park_like.png',
  schools: '/education.png',
  neighborhoods: '/neighborhood.png',
};

// Entity type labels
const ENTITY_LABELS: Record<string, string> = {
  cities: 'City',
  lakes: 'Lake',
  parks: 'Park',
  schools: 'School',
  neighborhoods: 'Neighborhood',
};

export default function AtlasEntityModal({
  isOpen,
  onClose,
  entityId,
  tableName,
}: AtlasEntityModalProps) {
  const [entityData, setEntityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !entityId || !tableName) {
      setEntityData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchEntity = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch from API route that queries atlas schema
        const response = await fetch(`/api/atlas/${tableName}/${entityId}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch ${tableName} entity`);
        }

        const data = await response.json();
        setEntityData(data);
      } catch (err) {
        console.error('[AtlasEntityModal] Error fetching entity:', err);
        setError(err instanceof Error ? err.message : 'Failed to load entity data');
      } finally {
        setLoading(false);
      }
    };

    fetchEntity();
  }, [isOpen, entityId, tableName]);

  if (!isOpen) return null;

  const iconPath = ICON_MAP[tableName] || '/custom.png';
  const entityLabel = ENTITY_LABELS[tableName] || tableName;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-[10px]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-md border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-[10px] flex-shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {iconPath && (
                <div className="relative w-6 h-6">
                  <Image
                    src={iconPath}
                    alt={entityLabel}
                    width={24}
                    height={24}
                    className="w-full h-full object-contain"
                    unoptimized
                  />
                </div>
              )}
              <h2 className="text-sm font-semibold text-gray-900">
                {entityLabel} Details
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-[10px] pt-0">
          {loading && (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-600">Loading entity data...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-xs font-medium text-red-800">Error</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && entityData && (
            <div className="space-y-3">
              {/* Entity Name */}
              {entityData.name && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Name</p>
                  <p className="text-xs text-gray-900">{entityData.name}</p>
                </div>
              )}

              {/* Raw Response Table */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Raw Response</p>
                <div className="bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="text-left p-2 font-semibold text-gray-700">Key</th>
                        <th className="text-left p-2 font-semibold text-gray-700">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(entityData).map(([key, value]) => (
                        <tr key={key} className="border-b border-gray-200 last:border-b-0">
                          <td className="p-2 font-medium text-gray-600 align-top">{key}</td>
                          <td className="p-2 text-gray-900 break-words">
                            {value === null ? (
                              <span className="text-gray-400 italic">null</span>
                            ) : value === undefined ? (
                              <span className="text-gray-400 italic">undefined</span>
                            ) : typeof value === 'object' ? (
                              <pre className="text-xs font-mono bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            ) : typeof value === 'boolean' ? (
                              <span className="font-mono">{String(value)}</span>
                            ) : (
                              String(value)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

