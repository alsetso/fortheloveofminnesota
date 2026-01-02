'use client';

import { useState, useEffect, useMemo } from 'react';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';

interface AtlasMapEntityListProps {
  tableName: string;
  searchQuery: string;
}

interface AtlasEntity {
  id: string;
  name: string;
  city_name: string | null;
  lat: number | null;
  lng: number | null;
}

export default function AtlasMapEntityList({
  tableName,
  searchQuery,
}: AtlasMapEntityListProps) {
  const router = useRouter();
  const { account } = useAuthStateSafe();
  const [entities, setEntities] = useState<AtlasEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isAdmin = account?.role === 'admin';

  // Fetch entities
  useEffect(() => {
    const fetchEntities = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) {
          params.set('search', searchQuery.trim());
        }
        const response = await fetch(`/api/atlas/${tableName}/entities?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setEntities(data.entities || []);
        }
      } catch (err) {
        console.error('Error fetching entities:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();
  }, [tableName, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) {
      return;
    }

    try {
      setDeletingId(id);
      const response = await fetch(`/api/admin/atlas/${tableName}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete record' }));
        throw new Error(errorData.error || 'Failed to delete record');
      }

      // Remove from local state
      setEntities(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete record');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEntityClick = (entity: AtlasEntity) => {
    // Dispatch event to select entity (will show detail view and fly to location)
    window.dispatchEvent(new CustomEvent('atlas-entity-select', {
      detail: { entityId: entity.id, tableName }
    }));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <p className="text-xs text-gray-600">Loading entities...</p>
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <p className="text-xs text-gray-600">
          {searchQuery.trim() ? 'No entities found.' : 'No entities available.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entities.map((entity) => {
        const isDeleting = deletingId === entity.id;

        return (
          <div
            key={entity.id}
            className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => handleEntityClick(entity)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                {entity.name && (
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('atlas-entity-select', {
                        detail: { entityId: entity.id, tableName }
                      }));
                    }}
                    className="text-xs font-semibold text-gray-900 truncate hover:text-gray-700 underline text-left"
                  >
                    {entity.name}
                  </button>
                )}
                {entity.city_name && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-xs text-gray-600 truncate">
                      {entity.city_name}
                    </span>
                  </>
                )}
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link
                    href={`/admin/atlas/${tableName}/${entity.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
                    title="Edit record"
                  >
                    <PencilIcon className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(entity.id);
                    }}
                    disabled={isDeleting}
                    className="p-1 text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Delete record"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

