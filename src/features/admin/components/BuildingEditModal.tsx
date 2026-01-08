'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PhotoIcon, XCircleIcon, MapPinIcon, CheckIcon } from '@heroicons/react/24/outline';
import { createPortal } from 'react-dom';
import Image from 'next/image';

interface Building {
  id: string;
  type: 'state' | 'city' | 'town' | 'federal';
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  full_address: string | null;
  cover_images: string[] | null;
  website: string | null;
  created_at: string;
  updated_at: string;
}

interface BuildingEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  building?: Building | null;
  onSave: () => void;
}

export default function BuildingEditModal({
  isOpen,
  onClose,
  building,
  onSave,
}: BuildingEditModalProps) {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    type: 'state' as 'state' | 'city' | 'town' | 'federal',
    name: '',
    description: '',
    lat: '',
    lng: '',
    full_address: '',
    website: '',
    cover_images: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    console.log('[BuildingEditModal] Component mounted, isOpen:', isOpen, 'building:', building?.id || null);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    console.log('[BuildingEditModal] Props changed:', { isOpen, building: building?.id || null, mounted });
  }, [isOpen, building, mounted]);

  useEffect(() => {
    if (building) {
      // Edit mode - use building data
      setFormData({
        type: building.type,
        name: building.name,
        description: building.description || '',
        lat: building.lat?.toString() || '',
        lng: building.lng?.toString() || '',
        full_address: building.full_address || '',
        website: building.website || '',
        cover_images: building.cover_images || [],
      });
    } else {
      // Create mode - check for pending data from address search
      const pendingData = (window as any).__pendingBuildingData;
      if (pendingData) {
        // Ensure lat/lng are properly formatted as strings with enough precision
        const latStr = pendingData.lat != null ? parseFloat(pendingData.lat).toString() : '';
        const lngStr = pendingData.lng != null ? parseFloat(pendingData.lng).toString() : '';
        
        setFormData({
          type: 'state' as 'state' | 'city' | 'town' | 'federal',
          name: '',
          description: '',
          lat: latStr,
          lng: lngStr,
          full_address: pendingData.full_address || '',
          website: '',
          cover_images: [],
        });
        
        // Don't clear pending data yet - keep it in case modal closes and reopens
        // It will be cleared when form is submitted or closed
      } else {
        setFormData({
          type: 'state' as 'state' | 'city' | 'town' | 'federal',
          name: '',
          description: '',
          lat: '',
          lng: '',
          full_address: '',
          website: '',
          cover_images: [],
        });
      }
    }
    // Reset edit location mode when modal opens/closes
    setIsEditingLocation(false);
  }, [building, isOpen]);

  // Notify parent when edit location mode changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('building-edit-location-mode', {
      detail: { isEditing: isEditingLocation },
    }));
  }, [isEditingLocation]);

  // Listen for map clicks when in edit location mode
  useEffect(() => {
    if (!isEditingLocation) return;

    const handleMapClick = (e: CustomEvent) => {
      const { lat, lng } = e.detail;
      if (lat != null && lng != null) {
        setFormData((prev) => ({
          ...prev,
          lat: parseFloat(lat).toString(),
          lng: parseFloat(lng).toString(),
        }));
        setIsEditingLocation(false);
      }
    };

    window.addEventListener('building-edit-location-click', handleMapClick as EventListener);
    return () => {
      window.removeEventListener('building-edit-location-click', handleMapClick as EventListener);
      // Clean up edit mode when component unmounts
      window.dispatchEvent(new CustomEvent('building-edit-location-mode', {
        detail: { isEditing: false },
      }));
    };
  }, [isEditingLocation]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/admin/buildings/upload-image', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }

      const data = await response.json();
      setFormData((prev) => ({
        ...prev,
        cover_images: [...prev.cover_images, data.path],
      }));
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      cover_images: prev.cover_images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        type: formData.type,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        lat: formData.lat ? parseFloat(formData.lat) : null,
        lng: formData.lng ? parseFloat(formData.lng) : null,
        full_address: formData.full_address.trim() || null,
        website: formData.website.trim() || null,
        cover_images: formData.cover_images.length > 0 ? formData.cover_images : null,
      };

      const url = building
        ? `/api/admin/buildings/${building.id}`
        : '/api/admin/buildings';
      const method = building ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save building');
      }

      onSave();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save building');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      console.log('[BuildingEditModal] Opening modal - setting transform');
      document.body.style.overflow = 'hidden';
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const modal = document.getElementById('building-edit-modal');
        console.log('[BuildingEditModal] Modal element found:', modal);
        if (modal) {
          modal.style.transform = 'translateY(0)';
          console.log('[BuildingEditModal] Transform applied:', modal.style.transform);
        } else {
          console.error('[BuildingEditModal] Modal element not found!');
        }
      }, 10);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    const modal = document.getElementById('building-edit-modal');
    if (modal) {
      modal.style.transform = 'translateY(100%)';
    }
    setTimeout(() => {
      // Clear pending data when modal closes
      delete (window as any).__pendingBuildingData;
      onClose();
    }, 300);
  };

  if (!isOpen || !mounted) {
    console.log('[BuildingEditModal] Not rendering - isOpen:', isOpen, 'mounted:', mounted);
    return null;
  }

  console.log('[BuildingEditModal] Rendering modal');

  return createPortal(
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white shadow-2xl transition-all duration-300 ease-out flex flex-col rounded-t-3xl"
        id="building-edit-modal"
        style={{
          transform: 'translateY(100%)',
          maxHeight: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">
            {building ? 'Edit Building' : 'Create Building'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 -mr-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            {/* Type */}
            <div>
              <label className="text-xs font-medium text-gray-900 mb-1 block">
                Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as 'state' | 'city' | 'town' | 'federal' })
                }
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                required
              >
                <option value="state">State</option>
                <option value="city">City</option>
                <option value="town">Town</option>
                <option value="federal">Federal</option>
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-medium text-gray-900 mb-1 block">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter building name"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-gray-900 mb-1 block">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter building description"
                rows={3}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
              />
            </div>

            {/* Full Address */}
            <div>
              <label className="text-xs font-medium text-gray-900 mb-1 block">
                Full Address
              </label>
              <input
                type="text"
                value={formData.full_address}
                onChange={(e) => setFormData({ ...formData, full_address: e.target.value })}
                placeholder="e.g., 123 Main St, Minneapolis, MN 55401"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>

            {/* Website */}
            <div>
              <label className="text-xs font-medium text-gray-900 mb-1 block">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>

            {/* Cover Images Upload */}
            <div>
              <label className="text-xs font-medium text-gray-900 mb-1 block">
                Cover Images
              </label>
              
              {/* Image Previews */}
              {formData.cover_images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {formData.cover_images.map((imageUrl, index) => (
                    <div key={index} className="relative aspect-video rounded-md overflow-hidden border border-gray-200">
                      <Image
                        src={imageUrl}
                        alt={`Preview ${index + 1}`}
                        fill
                        className="object-cover"
                        unoptimized={imageUrl.includes('supabase.co')}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        aria-label="Remove image"
                      >
                        <XCircleIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileInput}
                  className="hidden"
                  multiple
                />
                <PhotoIcon className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                <p className="text-xs text-gray-600">
                  {uploading ? 'Uploading...' : 'Click or drag to upload images'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  JPEG, PNG, WebP, GIF (max 5MB)
                </p>
              </div>
            </div>

            {/* Coordinates */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-900">
                  Location
                </label>
                {!isEditingLocation ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingLocation(true)}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <MapPinIcon className="w-3 h-3" />
                    Edit Location
                  </button>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-0.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-md">
                    <MapPinIcon className="w-3 h-3" />
                    Click map to set coordinates
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                    placeholder="44.9778"
                    readOnly={!isEditingLocation}
                    className={`w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 ${
                      !isEditingLocation ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                    placeholder="-93.2650"
                    readOnly={!isEditingLocation}
                    className={`w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 ${
                      !isEditingLocation ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>
              {isEditingLocation && (
                <button
                  type="button"
                  onClick={() => setIsEditingLocation(false)}
                  className="mt-1.5 flex items-center gap-1 px-2 py-0.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <CheckIcon className="w-3 h-3" />
                  Done
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded-md border border-red-200">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : building ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body
  );
}

