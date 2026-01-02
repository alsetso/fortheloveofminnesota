'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface MapIdSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapId: string;
  initialData: {
    title: string;
    description: string | null;
    visibility: 'public' | 'private' | 'shared';
    map_style: 'street' | 'satellite' | 'light' | 'dark';
    meta?: {
      buildingsEnabled?: boolean;
      pitch?: number;
      terrainEnabled?: boolean;
      center?: [number, number];
      zoom?: number;
    } | null;
  };
  onUpdate?: (updatedData: any) => void;
}

export default function MapIdSettingsModal({
  isOpen,
  onClose,
  mapId,
  initialData,
  onUpdate,
}: MapIdSettingsModalProps) {
  const [formData, setFormData] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/maps/${mapId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update map');
      }

      const updatedMap = await response.json();
      if (onUpdate) {
        onUpdate(updatedMap);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update map');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-[10px]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white rounded-md border border-gray-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-[10px] py-[10px] border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Map Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-[10px]">
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
                className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors"
                placeholder="Map title"
                disabled={saving}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-xs font-medium text-gray-500 mb-0.5">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors resize-none"
                placeholder="Map description (optional)"
                rows={3}
                disabled={saving}
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
                className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors bg-white"
                disabled={saving}
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
                className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors bg-white"
                disabled={saving}
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
                  className="w-4 h-4 text-gray-900 border-gray-200 rounded focus:ring-gray-900"
                  disabled={saving}
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
                  className="w-full"
                  disabled={saving}
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
                  className="w-4 h-4 text-gray-900 border-gray-200 rounded focus:ring-gray-900"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 border-t border-gray-200">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


