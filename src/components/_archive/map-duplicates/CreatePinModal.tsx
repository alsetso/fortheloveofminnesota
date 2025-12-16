'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, CameraIcon, XCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { PublicMapPinService } from '@/features/map-pins/services/publicMapPinService';
import { LocationLookupService } from '@/features/map-pins/services/locationLookupService';
import { MAP_CONFIG } from '@/features/map/config';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';
import type { CreateMapPinData } from '@/types/map-pin';

interface CreatePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  coordinates: { lat: number; lng: number } | null;
  onPinCreated: () => void;
  onBack?: () => void; // Callback to open location details
}


export default function CreatePinModal({
  isOpen,
  onClose,
  coordinates,
  onPinCreated,
  onBack,
}: CreatePinModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationDebug, setLocationDebug] = useState<any>(null);
  const [isLookingUpLocation, setIsLookingUpLocation] = useState(false);
  const [locationIds, setLocationIds] = useState<{ cityId: string | null; countyId: string | null } | null>(null);
  const [pinCategory, setPinCategory] = useState<string>('');
  const [address, setAddress] = useState<string | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  // Reverse geocode to get address
  const reverseGeocode = async (lng: number, lat: number): Promise<string | null> => {
    const token = MAP_CONFIG.MAPBOX_TOKEN;
    if (!token) {
      return null;
    }

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`;
      const params = new URLSearchParams({
        access_token: token,
        types: 'address,poi,place',
        limit: '1',
      });

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (!data.features || data.features.length === 0) {
        return null;
      }

      return data.features[0].place_name || null;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  };

  // Reset form and load location data when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setSelectedFile(null);
      setFilePreview(null);
      setError(null);
      setLocationDebug(null);
      setLocationIds(null);
      setPinCategory('');
      setAddress(null);
      
      // Look up city and county when modal opens
      if (coordinates) {
        setIsLookingUpLocation(true);
        setIsLoadingAddress(true);
        
        // Reverse geocode to get address
        reverseGeocode(coordinates.lng, coordinates.lat)
          .then((addr) => {
            setAddress(addr);
          })
          .catch((err) => {
            console.error('Error reverse geocoding:', err);
          })
          .finally(() => {
            setIsLoadingAddress(false);
          });
        
        LocationLookupService.getLocationIds(coordinates.lat, coordinates.lng)
          .then((result) => {
            // Store location IDs for use when submitting
            setLocationIds({
              cityId: result.cityId,
              countyId: result.countyId,
            });
            
            // Set debug info for display
            setLocationDebug({
              cityName: result.cityName,
              countyName: result.countyName,
              cityId: result.cityId,
              countyId: result.countyId,
              debug: result.debug,
            });
          })
          .catch((err) => {
            console.error('Error looking up location:', err);
            setLocationDebug({ error: err.message });
            setLocationIds(null);
          })
          .finally(() => {
            setIsLookingUpLocation(false);
          });
      }
    }
  }, [isOpen, coordinates]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      setError('Please select a valid image or video file');
      return;
    }

    // Validate file size (100MB)
    if (file.size > 100 * 1024 * 1024) {
      setError('File must be smaller than 100MB');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      // For videos, create object URL for preview
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveFile = () => {
    if (filePreview && selectedFile?.type.startsWith('video/')) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (filePreview && selectedFile?.type.startsWith('video/')) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview, selectedFile]);

  if (!isOpen || !coordinates) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim() && !selectedFile) {
      setError('Please add a description or photo');
      return;
    }

    if (!user) {
      setError('You must be logged in to create pins');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let mediaUrl: string | null = null;

      // Upload file if selected
      if (selectedFile) {
        setIsUploading(true);
        
        // Generate unique filename
        const fileExt = selectedFile.name.split('.').pop();
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const fileName = `${user.id}/map-pins/${timestamp}-${random}.${fileExt}`;

        // Upload to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from('map-pins-media')
          .upload(fileName, selectedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('map-pins-media')
          .getPublicUrl(fileName);

        if (!urlData?.publicUrl) {
          throw new Error('Failed to get file URL');
        }

        mediaUrl = urlData.publicUrl;
        setIsUploading(false);
      }

      // Use stored location IDs if available, otherwise look up again
      let finalLocationIds = locationIds;
      if (!finalLocationIds) {
        finalLocationIds = await LocationLookupService.getLocationIds(
          coordinates.lat,
          coordinates.lng
        );
      }

      // Validate that we have valid UUIDs if IDs are present
      const cityId = finalLocationIds.cityId && finalLocationIds.cityId.length === 36 
        ? finalLocationIds.cityId 
        : undefined;
      const countyId = finalLocationIds.countyId && finalLocationIds.countyId.length === 36 
        ? finalLocationIds.countyId 
        : undefined;

      // Create pin with media URL and location IDs
      const pinData: CreateMapPinData = {
        lat: coordinates.lat,
        lng: coordinates.lng,
        description: description.trim() || null,
        media_url: mediaUrl,
        city_id: cityId,
        county_id: countyId,
      };

      await PublicMapPinService.createPin(pinData);
      onPinCreated();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create pin';
      console.error('[CreatePinModal] Error creating pin:', errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div
      className="fixed bottom-0 left-1/2 z-[1001] bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out w-full max-w-[800px]"
      style={{
        transform: isOpen 
          ? 'translate(-50%, 0)' 
          : 'translate(-50%, 100%)',
        maxHeight: '90vh',
      }}
    >
        {/* Drag Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header - Minimal */}
        <div className="flex items-center justify-between px-4 py-3">
          {onBack ? (
            <button
              onClick={() => {
                onClose();
                onBack();
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              disabled={isSubmitting || isUploading}
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <div className="text-left">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Location</div>
                <div className="text-xs font-medium text-gray-900 truncate max-w-[200px]">
                  {isLoadingAddress ? 'Loading...' : address || (coordinates ? `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}` : '')}
                </div>
              </div>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors p-1"
              disabled={isSubmitting}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-sm font-semibold text-gray-900">Create Pin</h2>
          <button
            type="submit"
            form="create-pin-form"
            disabled={isSubmitting || isUploading || (!description.trim() && !selectedFile)}
            className="text-sm font-medium text-gray-900 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>

        {/* Form - Social feed style */}
        <form id="create-pin-form" onSubmit={handleSubmit} className="px-4 pb-4">
          {/* Location Details */}
          {coordinates && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs font-semibold text-gray-900 mb-1.5">Location Details</div>
              {address ? (
                <div className="text-xs text-gray-700 mb-1">{address}</div>
              ) : isLoadingAddress ? (
                <div className="text-xs text-gray-500 mb-1">Loading address...</div>
              ) : null}
              <div className="text-[10px] text-gray-500 font-mono">
                Lat: {coordinates.lat.toFixed(6)}, Lng: {coordinates.lng.toFixed(6)}
              </div>
            </div>
          )}

          {/* Description - Main input, no border */}
          <div className="mb-3">
            <textarea
              id="description"
              value={description}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= 240) {
                  setDescription(value);
                }
              }}
              maxLength={240}
              className="w-full px-0 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none"
              placeholder="What's going on here?"
              rows={4}
              autoFocus
              disabled={isSubmitting || isUploading}
            />
            <div className="flex justify-end mt-1">
              <span className={`text-xs ${description.length >= 240 ? 'text-red-500' : 'text-gray-400'}`}>
                {description.length}/240
              </span>
            </div>
          </div>


          {/* Media Preview */}
          {filePreview && (
            <div className="relative mb-3 rounded-lg overflow-hidden">
              {selectedFile?.type.startsWith('image/') ? (
                <img
                  src={filePreview}
                  alt="Preview"
                  className="w-full max-h-64 object-cover"
                />
              ) : (
                <video
                  src={filePreview}
                  className="w-full max-h-64 object-cover"
                  controls
                />
              )}
              <button
                type="button"
                onClick={handleRemoveFile}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full transition-colors backdrop-blur-sm"
                disabled={isSubmitting || isUploading}
              >
                <XCircleIcon className="w-5 h-5 text-white" />
              </button>
            </div>
          )}

          {/* Camera Icon Button */}
          {!selectedFile && (
            <div className="mb-3">
              <label className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isSubmitting || isUploading}
                />
                <CameraIcon className="w-5 h-5 text-gray-600" />
              </label>
            </div>
          )}

          {/* Location Debug Info */}
          {locationDebug && (
            <div className="mb-3 p-2 bg-gray-50 rounded text-xs">
              {isLookingUpLocation ? (
                <div className="text-gray-500">Looking up location...</div>
              ) : (
                <>
                  {locationDebug.cityName ? (
                    <div className="text-gray-700">{locationDebug.cityName}</div>
                  ) : locationDebug.error ? (
                    <div className="text-red-600">Error: {locationDebug.error}</div>
                  ) : (
                    <div className="text-gray-500">No city found</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-3">
              {error}
            </div>
          )}
        </form>
        </div>
    </div>
  );
}

