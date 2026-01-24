'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, CheckIcon, PencilIcon } from '@heroicons/react/24/outline';

interface MapSettingsClientProps {
  initialMap: {
    id: string;
    account_id: string;
    title: string;
    description: string | null;
    visibility: 'public' | 'private' | 'shared';
    map_style: 'street' | 'satellite' | 'light' | 'dark';
    type?: 'user' | 'community' | 'gov' | 'professional' | 'atlas' | 'user-generated' | null;
    custom_slug?: string | null;
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
}

export default function MapSettingsClient({ initialMap }: MapSettingsClientProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: initialMap.title,
    description: initialMap.description || '',
    visibility: initialMap.visibility,
    map_style: initialMap.map_style,
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
      
      // Redirect back to map page
      router.push(`/map/${initialMap.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update map');
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-3 py-3 flex items-center justify-between">
          <Link 
            href={`/map/${initialMap.id}`}
            className="flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="w-3 h-3" />
            Back
          </Link>
          <h1 className="text-sm font-semibold text-gray-900">Map Settings</h1>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={isEditing ? handleSubmit : handleEdit}
              disabled={isSaving}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                isEditing 
                  ? 'text-white bg-gray-900 hover:bg-gray-800'
                  : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-3 py-6">
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
              onChange={(e) => setFormData({ ...formData, visibility: e.target.value as 'public' | 'private' | 'shared' })}
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
              Map Style
            </label>
            <select
              id="map_style"
              value={formData.map_style}
              onChange={(e) => setFormData({ ...formData, map_style: e.target.value as 'street' | 'satellite' | 'light' | 'dark' })}
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
              disabled={!isEditing || isSaving}
            >
              <option value="street">Street</option>
              <option value="satellite">Satellite</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          {/* Meta Settings */}
          <div className="space-y-2 border-t border-gray-200 pt-3">
            <h3 className="text-xs font-semibold text-gray-900">Advanced Settings</h3>
            
            {/* Buildings Enabled */}
            <div className="flex items-center justify-between">
              <label htmlFor="buildingsEnabled" className="text-xs text-gray-600">
                Enable 3D Buildings
              </label>
              <input
                id="buildingsEnabled"
                type="checkbox"
                checked={formData.meta?.buildingsEnabled || false}
                onChange={(e) => setFormData({
                  ...formData,
                  meta: {
                    ...formData.meta,
                    buildingsEnabled: e.target.checked,
                  },
                })}
                className="w-4 h-4 text-gray-900 border-gray-200 rounded focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isEditing || isSaving}
              />
            </div>

            {/* Pitch */}
            <div>
              <label htmlFor="pitch" className="block text-xs text-gray-600 mb-0.5">
                Pitch: {formData.meta?.pitch || 0}°
              </label>
              <input
                id="pitch"
                type="range"
                min="0"
                max="60"
                value={formData.meta?.pitch || 0}
                onChange={(e) => setFormData({
                  ...formData,
                  meta: {
                    ...formData.meta,
                    pitch: parseInt(e.target.value),
                  },
                })}
                className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isEditing || isSaving}
              />
            </div>

            {/* Terrain Enabled */}
            <div className="flex items-center justify-between">
              <label htmlFor="terrainEnabled" className="text-xs text-gray-600">
                Enable Terrain
              </label>
              <input
                id="terrainEnabled"
                type="checkbox"
                checked={formData.meta?.terrainEnabled || false}
                onChange={(e) => setFormData({
                  ...formData,
                  meta: {
                    ...formData.meta,
                    terrainEnabled: e.target.checked,
                  },
                })}
                className="w-4 h-4 text-gray-900 border-gray-200 rounded focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isEditing || isSaving}
              />
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
