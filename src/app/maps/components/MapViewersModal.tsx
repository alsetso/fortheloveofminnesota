'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { XMarkIcon, UserIcon } from '@heroicons/react/24/outline';

interface MapViewer {
  account_id: string;
  account_username: string | null;
  account_first_name: string | null;
  account_last_name: string | null;
  account_image_url: string | null;
  viewed_at: string;
  view_count: number;
}

interface MapViewersModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapId: string;
  mapTitle: string;
}

export default function MapViewersModal({
  isOpen,
  onClose,
  mapId,
  mapTitle,
}: MapViewersModalProps) {
  const [viewers, setViewers] = useState<MapViewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !mapId) return;

    const fetchViewers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/maps/${mapId}/viewers`);
        if (!response.ok) {
          throw new Error('Failed to fetch viewers');
        }
        const data = await response.json();
        setViewers(data.viewers || []);
      } catch (err) {
        console.error('Error fetching map viewers:', err);
        setError('Failed to load viewers');
      } finally {
        setLoading(false);
      }
    };

    fetchViewers();
  }, [isOpen, mapId]);

  const getDisplayName = (viewer: MapViewer) => {
    if (viewer.account_username) {
      return `@${viewer.account_username}`;
    }
    if (viewer.account_first_name && viewer.account_last_name) {
      return `${viewer.account_first_name} ${viewer.account_last_name}`;
    }
    if (viewer.account_first_name) {
      return viewer.account_first_name;
    }
    return 'User';
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
          className="bg-white rounded-md border border-gray-200 shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-[10px] py-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Map Viewers</h2>
              <p className="text-xs text-gray-500 mt-0.5">{mapTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-[10px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-xs text-gray-500">{error}</p>
              </div>
            ) : viewers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-gray-500">No viewers yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {viewers.map((viewer) => (
                  <div
                    key={viewer.account_id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded transition-colors"
                  >
                    {/* Profile Photo */}
                    {viewer.account_image_url ? (
                      <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                        <Image
                          src={viewer.account_image_url}
                          alt={getDisplayName(viewer)}
                          width={24}
                          height={24}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 border border-gray-200">
                        <UserIcon className="w-3 h-3 text-gray-400" />
                      </div>
                    )}

                    {/* Name and View Count */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {getDisplayName(viewer)}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {viewer.view_count} {viewer.view_count === 1 ? 'view' : 'views'}
                      </p>
                    </div>

                    {/* Viewed At */}
                    <div className="text-[10px] text-gray-400">
                      {new Date(viewer.viewed_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
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

