'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { County, UpdateCountyData } from '@/features/admin/services/countyAdminService';
import DrawPolygonMap from '@/components/_archive/map/DrawPolygonMap';

interface CountyEditModalProps {
  isOpen: boolean;
  county: County | null;
  onClose: () => void;
  onSave: () => void;
}

export default function CountyEditModal({
  isOpen,
  county,
  onClose,
  onSave,
}: CountyEditModalProps) {
  const [formData, setFormData] = useState<UpdateCountyData>({
    name: '',
    population: 0,
    area_sq_mi: 0,
    polygon: null,
    meta_title: null,
    meta_description: null,
    website_url: null,
    other_urls: null,
    favorite: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (county) {
      let polygonData = county.polygon;
      if (polygonData && typeof polygonData === 'string') {
        try {
          polygonData = JSON.parse(polygonData);
        } catch {
          polygonData = null;
        }
      }

      setFormData({
        name: county.name,
        population: county.population,
        area_sq_mi: county.area_sq_mi,
        polygon: polygonData,
        meta_title: county.meta_title || null,
        meta_description: county.meta_description || null,
        website_url: county.website_url || null,
        other_urls: county.other_urls || null,
        favorite: county.favorite || false,
      });
    }
  }, [county]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!county) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/counties/${county.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update county' }));
        throw new Error(errorData.error || 'Failed to update county');
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update county');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !county) return null;

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
          className="bg-white rounded-md border border-gray-200 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-[10px] py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Edit County</h2>
            <button
              onClick={onClose}
              disabled={saving}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-[10px] space-y-3">
            {error && (
              <div className="px-[10px] py-2 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="county-name" className="block text-xs font-medium text-gray-700 mb-1.5">
                County Name
              </label>
              <input
                id="county-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                required
                disabled={saving}
              />
            </div>

            {/* Population and Area */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="county-population" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Population
                </label>
                <input
                  id="county-population"
                  type="number"
                  value={formData.population}
                  onChange={(e) => setFormData({ ...formData, population: parseInt(e.target.value) || 0 })}
                  className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  required
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="county-area" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Area (sq mi)
                </label>
                <input
                  id="county-area"
                  type="number"
                  step="0.01"
                  value={formData.area_sq_mi}
                  onChange={(e) => setFormData({ ...formData, area_sq_mi: parseFloat(e.target.value) || 0 })}
                  className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  required
                  disabled={saving}
                />
              </div>
            </div>

            {/* SEO Fields */}
            <div>
              <label htmlFor="county-meta-title" className="block text-xs font-medium text-gray-700 mb-1.5">
                SEO Title (optional, max 70 characters)
              </label>
              <input
                id="county-meta-title"
                type="text"
                maxLength={70}
                value={formData.meta_title || ''}
                onChange={(e) => setFormData({ ...formData, meta_title: e.target.value || null })}
                className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                disabled={saving}
              />
              <p className="mt-0.5 text-xs text-gray-500">
                {(formData.meta_title?.length || 0)} / 70 characters
              </p>
            </div>

            <div>
              <label htmlFor="county-meta-description" className="block text-xs font-medium text-gray-700 mb-1.5">
                SEO Description (optional, max 160 characters)
              </label>
              <textarea
                id="county-meta-description"
                maxLength={160}
                rows={3}
                value={formData.meta_description || ''}
                onChange={(e) => setFormData({ ...formData, meta_description: e.target.value || null })}
                className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                disabled={saving}
              />
              <p className="mt-0.5 text-xs text-gray-500">
                {(formData.meta_description?.length || 0)} / 160 characters
              </p>
            </div>

            {/* Website URL */}
            <div>
              <label htmlFor="county-website-url" className="block text-xs font-medium text-gray-700 mb-1.5">
                Official Website URL
              </label>
              <input
                id="county-website-url"
                type="url"
                value={formData.website_url || ''}
                onChange={(e) => setFormData({ ...formData, website_url: e.target.value || null })}
                className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                disabled={saving}
              />
            </div>

            {/* Other URLs */}
            <div>
              <label htmlFor="county-other-urls" className="block text-xs font-medium text-gray-700 mb-1.5">
                Other URLs (JSON array)
              </label>
              <textarea
                id="county-other-urls"
                rows={3}
                value={formData.other_urls ? JSON.stringify(formData.other_urls, null, 2) : ''}
                onChange={(e) => {
                  try {
                    const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : null;
                    if (Array.isArray(parsed) || parsed === null) {
                      setFormData({ ...formData, other_urls: parsed });
                    }
                  } catch {
                    // Invalid JSON, keep current value
                  }
                }}
                className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs font-mono focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                placeholder='["https://example1.com", "https://example2.com"]'
                disabled={saving}
              />
            </div>

            {/* Favorite */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.favorite || false}
                  onChange={(e) => setFormData({ ...formData, favorite: e.target.checked })}
                  className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
                  disabled={saving}
                />
                <span className="text-xs font-medium text-gray-700">Mark as favorite</span>
              </label>
            </div>

            {/* Polygon */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                County Boundary (Polygon)
              </label>
              <DrawPolygonMap
                initialPolygon={
                  formData.polygon &&
                  typeof formData.polygon === 'object' &&
                  (formData.polygon as { type?: string }).type &&
                  ((formData.polygon as { type?: string }).type === 'Polygon' || (formData.polygon as { type?: string }).type === 'MultiPolygon')
                    ? (formData.polygon as GeoJSON.Polygon | GeoJSON.MultiPolygon)
                    : null
                }
                onPolygonChange={(polygon) => {
                  setFormData({ ...formData, polygon: polygon as GeoJSON.Polygon | GeoJSON.MultiPolygon | null });
                }}
                height="400px"
                allowMultiPolygon={true}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

