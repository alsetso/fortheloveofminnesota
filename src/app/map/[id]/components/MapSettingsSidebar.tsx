'use client';

import { useState } from 'react';
import { CheckIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';

type BoundaryLayerKey = 'congressional_districts' | 'ctu_boundaries' | 'state_boundary' | 'county_boundaries';

function getSelectedBoundaryLayer(mapLayers?: Record<string, boolean> | null): BoundaryLayerKey | null {
  const layers = mapLayers || {};
  if (layers.congressional_districts) return 'congressional_districts';
  if (layers.ctu_boundaries) return 'ctu_boundaries';
  if (layers.state_boundary) return 'state_boundary';
  if (layers.county_boundaries) return 'county_boundaries';
  return null;
}

function toExclusiveMapLayers(selected: BoundaryLayerKey | null): Record<string, boolean> {
  return {
    congressional_districts: selected === 'congressional_districts',
    ctu_boundaries: selected === 'ctu_boundaries',
    state_boundary: selected === 'state_boundary',
    county_boundaries: selected === 'county_boundaries',
  };
}

interface MapSettingsSidebarProps {
  initialMap: {
    id: string;
    account_id: string;
    title: string;
    description: string | null;
    visibility: 'public' | 'private' | 'shared';
    map_style: 'street' | 'satellite' | 'light' | 'dark';
    map_layers?: Record<string, boolean> | null;
    type?: 'user' | 'community' | 'gov' | 'professional' | 'atlas' | 'user-generated' | null;
    collection_type?: 'community' | 'professional' | 'user' | 'atlas' | 'gov' | null;
    custom_slug?: string | null;
    is_primary?: boolean;
    hide_creator?: boolean;
    tags?: Array<{ emoji: string; text: string }> | null;
    meta?: {
      buildingsEnabled?: boolean;
      pitch?: number;
      terrainEnabled?: boolean;
      center?: [number, number];
      zoom?: number;
    } | null;
    created_at: string;
    updated_at: string;
  };
  onUpdated?: (updatedMap: any) => void;
}

export default function MapSettingsSidebar({ initialMap, onUpdated }: MapSettingsSidebarProps) {
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';
  
  const initialSelectedBoundary = getSelectedBoundaryLayer(initialMap.map_layers);

  const [formData, setFormData] = useState({
    title: initialMap.title,
    description: initialMap.description || '',
    visibility: initialMap.visibility,
    map_style: initialMap.map_style,
    type: initialMap.type || 'community',
    collection_type: initialMap.collection_type || null,
    custom_slug: initialMap.custom_slug || '',
    is_primary: initialMap.is_primary || false,
    hide_creator: initialMap.hide_creator || false,
    map_layers: toExclusiveMapLayers(initialSelectedBoundary),
    meta: initialMap.meta || {
      buildingsEnabled: false,
      pitch: 0,
      terrainEnabled: false,
    },
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setFormData({
      title: initialMap.title,
      description: initialMap.description || '',
      visibility: initialMap.visibility,
      map_style: initialMap.map_style,
      type: initialMap.type || 'community',
      collection_type: initialMap.collection_type || null,
      custom_slug: initialMap.custom_slug || '',
      is_primary: initialMap.is_primary || false,
      hide_creator: initialMap.hide_creator || false,
      map_layers: toExclusiveMapLayers(getSelectedBoundaryLayer(initialMap.map_layers)),
      meta: initialMap.meta || {
        buildingsEnabled: false,
        pitch: 0,
        terrainEnabled: false,
      },
    });
    setIsEditing(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/maps/${initialMap.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          visibility: formData.visibility,
          map_style: formData.map_style,
          type: formData.type || 'community',
          collection_type: formData.collection_type || null,
          custom_slug: formData.custom_slug?.trim() || null,
          is_primary: formData.is_primary,
          hide_creator: formData.hide_creator,
          map_layers: formData.map_layers,
          meta: formData.meta,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update map';
        try {
          const data = await response.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const updatedMap = data.map || data;

      setIsEditing(false);
      setIsSaving(false);
      if (onUpdated) {
        onUpdated(updatedMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update map');
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-900">Map settings</h2>
        <div className="flex items-center gap-1.5">
          {isEditing && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-2 py-1 text-[11px] font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type={isEditing ? 'submit' : 'button'}
            onClick={isEditing ? handleSubmit : handleEdit}
            disabled={isSaving}
            className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
              isEditing
                ? 'text-white bg-gray-900 hover:bg-gray-800'
                : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : isEditing ? (
              <>
                <CheckIcon className="w-3 h-3" />
                Save
              </>
            ) : (
              <>
                <PencilIcon className="w-3 h-3" />
                Edit
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-[10px]">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-xs font-medium text-gray-500 mb-0.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
              placeholder="Map title"
              disabled={!isEditing || isSaving}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-xs font-medium text-gray-500 mb-0.5">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
              placeholder="Map description (optional)"
              rows={3}
              disabled={!isEditing || isSaving}
            />
          </div>

          {/* Visibility */}
          <div>
            <label htmlFor="visibility" className="block text-xs font-medium text-gray-500 mb-0.5">
              Visibility
            </label>
            <select
              id="visibility"
              value={formData.visibility}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  visibility: e.target.value as 'public' | 'private' | 'shared',
                })
              }
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
              disabled={!isEditing || isSaving}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="shared">Shared</option>
            </select>
          </div>

          {/* Map Style */}
          <div>
            <label htmlFor="map_style" className="block text-xs font-medium text-gray-500 mb-0.5">
              Map style
            </label>
            <select
              id="map_style"
              value={formData.map_style}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  map_style: e.target.value as 'street' | 'satellite' | 'light' | 'dark',
                })
              }
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
              disabled={!isEditing || isSaving}
            >
              <option value="street">Street</option>
              <option value="satellite">Satellite</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          {/* Custom URL Slug */}
          <div>
            <label htmlFor="custom_slug" className="block text-xs font-medium text-gray-500 mb-0.5">
              Custom URL slug
            </label>
            <input
              id="custom_slug"
              type="text"
              value={formData.custom_slug}
              onChange={(e) => {
                // Only allow lowercase letters, numbers, and hyphens
                const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                setFormData({ ...formData, custom_slug: value });
              }}
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
              placeholder="my-custom-map"
              disabled={!isEditing || isSaving}
              pattern="[a-z0-9-]+"
              minLength={3}
              maxLength={100}
            />
            <p className="text-[11px] text-gray-500 mt-0.5">
              Use a custom URL like /map/my-custom-map. Only lowercase letters, numbers, and hyphens allowed.
            </p>
          </div>

          {/* Collection Type */}
          <div>
            <label htmlFor="collection_type" className="block text-xs font-medium text-gray-500 mb-0.5">
              Collection type
            </label>
            <select
              id="collection_type"
              value={formData.collection_type || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  collection_type: e.target.value ? (e.target.value as 'community' | 'professional' | 'user' | 'atlas' | 'gov') : null,
                })
              }
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
              disabled={!isEditing || isSaving}
            >
              <option value="">None</option>
              <option value="community">Community</option>
              {isAdmin && (
                <>
                  <option value="professional">Professional</option>
                  <option value="user">User</option>
                  <option value="atlas">Atlas</option>
                  <option value="gov">Government</option>
                </>
              )}
            </select>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Set to "Community" to show this map in the community tab. {isAdmin ? 'Admins can set other collection types.' : ''}
            </p>
          </div>

          {/* Admin-only settings */}
          {isAdmin && (
            <div className="space-y-2 border-t border-gray-200 pt-3">
              <h3 className="text-xs font-semibold text-gray-900">Admin settings</h3>

              {/* Is Primary */}
              <div className="flex items-center justify-between">
                <label htmlFor="is_primary" className="text-xs text-gray-600">
                  Featured map
                </label>
                <input
                  id="is_primary"
                  type="checkbox"
                  checked={formData.is_primary}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_primary: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                  disabled={!isEditing || isSaving}
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Featured maps are highlighted in the maps listing
              </p>

              {/* Hide Creator */}
              <div className="flex items-center justify-between">
                <label htmlFor="hide_creator" className="text-xs text-gray-600">
                  Hide creator badge
                </label>
                <input
                  id="hide_creator"
                  type="checkbox"
                  checked={formData.hide_creator}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hide_creator: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                  disabled={!isEditing || isSaving}
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Hide the creator badge on the map card
              </p>
            </div>
          )}

          {/* Meta Settings */}
          <div className="space-y-2 border-t border-gray-200 pt-3">
            <h3 className="text-xs font-semibold text-gray-900">Advanced settings</h3>

            {/* Default boundary layer */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Default boundary layer</span>
              </div>
              <div className="space-y-1">
                {(
                  [
                    { id: 'none', label: 'None' },
                    { id: 'congressional_districts', label: 'Congressional districts' },
                    { id: 'ctu_boundaries', label: 'CTU boundaries' },
                    { id: 'county_boundaries', label: 'County boundaries' },
                    { id: 'state_boundary', label: 'State boundary' },
                  ] as const
                ).map((opt) => {
                  const selected = getSelectedBoundaryLayer(formData.map_layers);
                  const isChecked = opt.id === 'none' ? selected === null : selected === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className="flex items-center justify-between gap-2 text-xs text-gray-700"
                    >
                      <span className="text-xs text-gray-600">{opt.label}</span>
                      <input
                        type="radio"
                        name="default-boundary-layer"
                        checked={isChecked}
                        onChange={() => {
                          const nextSelected = opt.id === 'none' ? null : (opt.id as BoundaryLayerKey);
                          setFormData({
                            ...formData,
                            map_layers: toExclusiveMapLayers(nextSelected),
                          });
                        }}
                        className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                        disabled={!isEditing || isSaving}
                      />
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500">
                Only one boundary layer can be set as the default.
              </p>
            </div>

            {/* Buildings Enabled */}
            <div className="flex items-center justify-between">
              <label htmlFor="buildingsEnabled" className="text-xs text-gray-600">
                Enable 3D buildings
              </label>
              <input
                id="buildingsEnabled"
                type="checkbox"
                checked={formData.meta?.buildingsEnabled || false}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    meta: {
                      ...formData.meta,
                      buildingsEnabled: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                disabled={!isEditing || isSaving}
              />
            </div>

            {/* Pitch */}
            <div>
              <label htmlFor="pitch" className="block text-xs font-medium text-gray-600 mb-0.5">
                Pitch (0–60°)
              </label>
              <input
                id="pitch"
                type="number"
                min={0}
                max={60}
                value={formData.meta?.pitch ?? 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    meta: {
                      ...formData.meta,
                      pitch: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
                disabled={!isEditing || isSaving}
              />
            </div>

            {/* Terrain Enabled */}
            <div className="flex items-center justify-between">
              <label htmlFor="terrainEnabled" className="text-xs text-gray-600">
                Enable terrain
              </label>
              <input
                id="terrainEnabled"
                type="checkbox"
                checked={formData.meta?.terrainEnabled || false}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    meta: {
                      ...formData.meta,
                      terrainEnabled: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                disabled={!isEditing || isSaving}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

