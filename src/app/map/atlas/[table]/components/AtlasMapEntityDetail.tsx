'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeftIcon, PencilIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { formatNumber } from '@/lib/utils/formatting';

interface AtlasMapEntityDetailProps {
  tableName: string;
  entityId: string;
  onBack: () => void;
}

interface EntityData {
  [key: string]: any;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

export default function AtlasMapEntityDetail({
  tableName,
  entityId,
  onBack,
}: AtlasMapEntityDetailProps) {
  const { account } = useAuthStateSafe();
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = account?.role === 'admin';

  useEffect(() => {
    const fetchEntity = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/atlas/${tableName}/${entityId}`);
        if (response.ok) {
          const data = await response.json();
          setEntity(data.entity || null);
        }
      } catch (err) {
        console.error('Error fetching entity:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEntity();
  }, [tableName, entityId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Back to list"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div className="text-sm font-semibold text-gray-900">Loading...</div>
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Back to list"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div className="text-sm font-semibold text-gray-900">Entity not found</div>
        </div>
      </div>
    );
  }

  // Get displayable fields (exclude internal fields)
  const excludeFields = ['id', 'created_at', 'updated_at', 'polygon', 'boundary_lines'];
  const displayFields = Object.keys(entity)
    .filter((key) => !excludeFields.includes(key) && !key.startsWith('_'))
    .sort((a, b) => {
      // Priority order
      const priority = ['name', 'slug', 'description', 'address', 'lat', 'lng', 'city_id', 'city_name'];
      const aIndex = priority.indexOf(a);
      const bIndex = priority.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

  const hasCoords = entity.lat && entity.lng && !isNaN(parseFloat(String(entity.lat))) && !isNaN(parseFloat(String(entity.lng)));

  return (
    <div className="space-y-3">
      {/* Header with back button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Back to list"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-gray-900">
            {entity.name || 'Unnamed Entity'}
          </h2>
        </div>
        {isAdmin && (
          <Link
            href={`/admin/atlas/${tableName}/${entityId}`}
            className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
            title="Edit record"
          >
            <PencilIcon className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Focus on map button */}
      {hasCoords && (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('atlas-entity-focus', {
                detail: { lat: parseFloat(String(entity.lat)), lng: parseFloat(String(entity.lng)) }
              }));
            }}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
          >
            <MapPinIcon className="w-3 h-3" />
            <span>Focus on Map</span>
          </button>
        </div>
      )}

      {/* Entity Details */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-medium text-gray-500">Details</div>
        <div className="space-y-1">
          {displayFields.map((key) => {
            const value = entity[key];
            if (value === null || value === undefined || value === '') return null;

            let displayValue: string | React.ReactElement = String(value);
            
            // Format special fields
            if (key === 'lat' || key === 'lng') {
              displayValue = parseFloat(String(value)).toFixed(6);
            } else if (key === 'population' || key === 'enrollment' || key === 'area_acres' || key === 'mile_marker') {
              displayValue = formatNumber(value);
            } else if (key === 'created_at' || key === 'updated_at') {
              displayValue = formatDate(value);
            } else if (typeof value === 'boolean') {
              displayValue = value ? 'Yes' : 'No';
            } else if (typeof value === 'object') {
              displayValue = JSON.stringify(value, null, 2);
            }

            return (
              <div key={key} className="bg-white border border-gray-200 rounded-md p-[10px]">
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-gray-500 font-medium min-w-[100px] capitalize">
                    {key.replace(/_/g, ' ')}:
                  </span>
                  <span className="text-gray-600 flex-1 break-words">{displayValue}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

