'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  MapPinIcon, 
  PencilIcon, 
  TrashIcon, 
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  VideoCameraIcon,
  MapIcon,
} from '@heroicons/react/24/outline';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { getMapUrl, getMapUrlWithPin } from '@/lib/maps/urls';
import { useToast } from '@/features/ui/hooks/useToast';

interface Pin {
  id: string;
  lat: number;
  lng: number;
  caption: string | null;
  description: string | null;
  emoji: string | null;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
  map: {
    id: string;
    name: string;
    slug: string | null;
    visibility: string;
  } | null;
  mention_type: {
    id: string;
    emoji: string;
    name: string;
  } | null;
}

interface PinLimit {
  has_feature: boolean;
  limit_value: number | null;
  limit_type: string | null;
  is_unlimited: boolean;
}

export default function PinsSettingsClient() {
  const { account } = useSettings();
  const { success, error: showError } = useToast();
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinLimit, setPinLimit] = useState<PinLimit | null>(null);
  const [editingPin, setEditingPin] = useState<Pin | null>(null);
  const [editForm, setEditForm] = useState({
    caption: '',
    description: '',
    emoji: '',
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (account?.id) {
      fetchPins();
      fetchPinLimit();
    }
  }, [account?.id, page]);

  const fetchPins = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const response = await fetch(`/api/pins?limit=${limit}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        setPins(data.pins || []);
        setTotal(data.total || 0);
      } else {
        showError('Failed to fetch pins');
      }
    } catch (err) {
      console.error('Error fetching pins:', err);
      showError('Failed to load pins');
    } finally {
      setLoading(false);
    }
  };

  const fetchPinLimit = async () => {
    if (!account?.id) return;
    try {
      const response = await fetch(`/api/billing/user-features`);
      if (response.ok) {
        const data = await response.json();
        const pinsFeature = data.features?.find((f: any) => f.slug === 'pins' || f.slug === 'map_pins');
        if (pinsFeature) {
          setPinLimit({
            has_feature: true,
            limit_value: pinsFeature.limit_value,
            limit_type: pinsFeature.limit_type,
            is_unlimited: pinsFeature.is_unlimited || false,
          });
        } else {
          // Default: assume unlimited if feature doesn't exist in billing system
          setPinLimit({
            has_feature: true,
            limit_value: null,
            limit_type: 'unlimited',
            is_unlimited: true,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching pin limit:', err);
      // Default on error: assume unlimited
      setPinLimit({
        has_feature: true,
        limit_value: null,
        limit_type: 'unlimited',
        is_unlimited: true,
      });
    }
  };

  const handleDelete = async (pinId: string) => {
    if (!confirm('Are you sure you want to delete this pin?')) return;

    try {
      const response = await fetch(`/api/pins/${pinId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        success('Pin deleted successfully');
        fetchPins();
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to delete pin');
      }
    } catch (err) {
      console.error('Error deleting pin:', err);
      showError('Failed to delete pin');
    }
  };

  const handleEdit = (pin: Pin) => {
    setEditingPin(pin);
    setEditForm({
      caption: pin.caption || '',
      description: pin.description || '',
      emoji: pin.emoji || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingPin) return;

    try {
      const response = await fetch(`/api/pins/${editingPin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: editForm.caption || null,
          description: editForm.description || null,
          emoji: editForm.emoji || null,
        }),
      });

      if (response.ok) {
        success('Pin updated successfully');
        setEditingPin(null);
        fetchPins();
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to update pin');
      }
    } catch (err) {
      console.error('Error updating pin:', err);
      showError('Failed to update pin');
    }
  };

  const getPinLimitDisplay = () => {
    if (!pinLimit) return null;
    
    if (!pinLimit.has_feature) {
      return 'Not available on your plan';
    }
    
    if (pinLimit.is_unlimited) {
      return `${total} pins (unlimited)`;
    }
    
    if (pinLimit.limit_type === 'count' && pinLimit.limit_value !== null) {
      return `${total} / ${pinLimit.limit_value} pins`;
    }
    
    return `${total} pins`;
  };

  const canCreateMore = () => {
    if (!pinLimit || !pinLimit.has_feature) return false;
    if (pinLimit.is_unlimited) return true;
    if (pinLimit.limit_type === 'count' && pinLimit.limit_value !== null) {
      return total < pinLimit.limit_value;
    }
    return true;
  };

  return (
    <div className="space-y-3">
      {/* Pin Limits */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Pin Limits</h3>
        <p className="text-xs text-gray-600 mb-2">
          {getPinLimitDisplay() || 'Loading...'}
        </p>
        {pinLimit && !canCreateMore() && pinLimit.has_feature && (
          <Link href="/settings/plans" className="text-xs font-medium text-blue-600 hover:underline">
            Upgrade to create more pins
          </Link>
        )}
      </div>

      {/* Pins List */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <h3 className="text-sm font-semibold text-gray-900 px-[10px] py-3 border-b border-gray-200">
          Your Pins
        </h3>
        {loading ? (
          <div className="px-[10px] py-4 text-xs text-gray-500">Loading...</div>
        ) : pins.length === 0 ? (
          <div className="px-[10px] py-4 text-xs text-gray-500">No pins yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-[10px] py-2 font-semibold text-gray-900">Media</th>
                  <th className="text-left px-[10px] py-2 font-semibold text-gray-900">Pin</th>
                  <th className="text-left px-[10px] py-2 font-semibold text-gray-900">Map</th>
                  <th className="text-left px-[10px] py-2 font-semibold text-gray-900">Created</th>
                  <th className="text-right px-[10px] py-2 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pins.map((pin) => {
                  const hasImage = !!pin.image_url;
                  const hasVideo = !!pin.video_url;
                  const hasMedia = hasImage || hasVideo;
                  
                  return (
                    <tr key={pin.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                      <td className="px-[10px] py-2">
                        {hasMedia ? (
                          <div className="w-8 h-8 rounded overflow-hidden border border-gray-200 bg-gray-100 relative flex-shrink-0">
                            {hasImage && pin.image_url ? (
                              <Image
                                src={pin.image_url}
                                alt=""
                                fill
                                className="object-cover"
                                unoptimized={pin.image_url.includes('supabase.co') || pin.image_url.startsWith('data:')}
                              />
                            ) : hasVideo && pin.video_url ? (
                              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                <VideoCameraIcon className="w-3 h-3 text-gray-500" />
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
                            <MapPinIcon className="w-3 h-3 text-gray-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-[10px] py-2">
                        <div className="flex items-center gap-1.5">
                          {pin.emoji && <span className="text-sm">{pin.emoji}</span>}
                          <span className="text-gray-900 font-medium truncate max-w-[150px]">
                            {pin.caption || pin.description || 'Untitled Pin'}
                          </span>
                        </div>
                      </td>
                    <td className="px-[10px] py-2">
                      {pin.map ? (
                        <Link
                          href={getMapUrl({ id: pin.map.id, slug: pin.map.slug })}
                          className="text-gray-600 hover:text-gray-900 font-medium"
                        >
                          {pin.map.name || 'Unnamed Map'}
                        </Link>
                      ) : (
                        <span className="text-gray-400">Unknown Map</span>
                      )}
                    </td>
                    <td className="px-[10px] py-2 text-gray-600">
                      {new Date(pin.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-[10px] py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {pin.map && Number.isFinite(pin.lat) && Number.isFinite(pin.lng) && (
                          <>
                            <Link
                              href={getMapUrlWithPin({ id: pin.map.id, slug: pin.map.slug }, pin.lat, pin.lng)}
                              className="text-gray-600 hover:text-gray-900 inline-flex items-center gap-0.5"
                              title="View on map"
                            >
                              <MapIcon className="w-3 h-3" />
                            </Link>
                            <span className="text-gray-300">|</span>
                          </>
                        )}
                        {pin.map && (
                          <>
                            <Link
                              href={getMapUrl({ id: pin.map.id, slug: pin.map.slug })}
                              className="text-gray-600 hover:text-gray-900 inline-flex items-center gap-0.5"
                              title="View map"
                            >
                              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                            </Link>
                            <span className="text-gray-300">|</span>
                          </>
                        )}
                        <button
                          onClick={() => handleEdit(pin)}
                          className="text-gray-600 hover:text-gray-900 inline-flex items-center gap-0.5"
                          title="Edit pin"
                        >
                          <PencilIcon className="w-3 h-3" />
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => handleDelete(pin.id)}
                          className="text-gray-600 hover:text-red-600 inline-flex items-center gap-0.5"
                          title="Delete pin"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-[10px] py-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Page {page} of {Math.ceil(total / limit)}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(Math.ceil(total / limit), p + 1))}
                disabled={page >= Math.ceil(total / limit)}
                className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingPin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-md p-[10px] w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Edit Pin</h3>
              <button
                onClick={() => setEditingPin(null)}
                className="text-gray-500 hover:text-gray-900 text-xs"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Emoji</label>
                <input
                  type="text"
                  value={editForm.emoji}
                  onChange={(e) => setEditForm({ ...editForm, emoji: e.target.value })}
                  className="w-full px-[10px] py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="🎯"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Caption</label>
                <input
                  type="text"
                  value={editForm.caption}
                  onChange={(e) => setEditForm({ ...editForm, caption: e.target.value })}
                  className="w-full px-[10px] py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="Pin caption"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-[10px] py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="Pin description"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setEditingPin(null)}
                  className="px-3 py-1 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
