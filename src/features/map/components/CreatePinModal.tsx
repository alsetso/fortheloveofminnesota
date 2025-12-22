'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { XMarkIcon, CameraIcon, XCircleIcon, ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { PublicMapPinService } from '@/features/map-pins/services/publicMapPinService';
import { LocationLookupService } from '@/features/map-pins/services/locationLookupService';
import { MAP_CONFIG } from '@/features/map/config';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';
import { GuestAccountService } from '@/features/auth/services/guestAccountService';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { CreateMapPinData } from '@/types/map-pin';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import PinPreviewModal from './PinPreviewModal';

// Pin data returned after creation
interface CreatedPin {
  id: string;
  lat: number;
  lng: number;
  description: string | null;
  media_url: string | null;
  visibility: string;
  view_count: number | null;
  created_at: string;
  updated_at: string;
}

interface CreatePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  coordinates: { lat: number; lng: number } | null;
  onPinCreated: (pin?: CreatedPin) => void; // Optional pin data for optimistic updates
  onBack?: () => void; // Callback to open location details
  onVisibilityChange?: (visibility: 'public' | 'only_me') => void; // Callback when visibility changes
  map?: MapboxMapInstance | null; // Map instance for screenshot capture
}


export default function CreatePinModal({
  isOpen,
  onClose,
  coordinates,
  onPinCreated,
  onBack,
  onVisibilityChange,
  map,
}: CreatePinModalProps) {
  const { user } = useAuth();
  const { openSuccessPin, updateSuccessPin } = useAppModalContextSafe();
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
  const [visibility, setVisibility] = useState<'public' | 'only_me'>('public');
  const [showVisibilityTooltip, setShowVisibilityTooltip] = useState(false);
  const [citySlug, setCitySlug] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);

  // Notify parent when visibility changes
  useEffect(() => {
    if (isOpen && onVisibilityChange) {
      onVisibilityChange(visibility);
    }
  }, [visibility, isOpen, onVisibilityChange]);

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
      setVisibility('public');
      setCitySlug(null);
      
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
          .then(async (result) => {
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
            
            // Fetch city slug if cityId exists
            if (result.cityId) {
              try {
                const { data: city } = await supabase
                  .from('cities')
                  .select('slug')
                  .eq('id', result.cityId)
                  .single();
                
                if (city?.slug) {
                  setCitySlug(city.slug);
                }
              } catch (error) {
                console.error('[CreatePinModal] Error fetching city slug:', error);
              }
            }
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

  // Screenshot capture function
  const captureMapScreenshot = useCallback(async (): Promise<string | null> => {
    if (!map) {
      return null;
    }

    setIsCapturingScreenshot(true);

    try {
      // Wait for map to finish rendering
      await new Promise<void>((resolve) => {
        if ((map as any).loaded()) {
          resolve();
        } else {
          (map as any).once('idle', () => resolve());
        }
      });

      // Small delay to ensure everything is rendered
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const canvas = (map as any).getCanvas() as HTMLCanvasElement;
      if (!canvas) {
        throw new Error('Canvas not available');
      }

      // Check if canvas is valid
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas has invalid dimensions');
      }

      const dataUrl = canvas.toDataURL('image/png', 0.9);
      
      // Validate data URL
      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Invalid screenshot data');
      }
      
      setIsCapturingScreenshot(false);
      return dataUrl;
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      setIsCapturingScreenshot(false);
      return null;
    }
  }, [map]);

  if (!isOpen || !coordinates) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim() && !selectedFile) {
      setError('Please add a description or photo');
      return;
    }

    if (!coordinates) {
      setError('Coordinates are required');
      return;
    }

    setError(null);

    // Capture screenshot if map is available
    let capturedScreenshot: string | null = null;
    if (map) {
      capturedScreenshot = await captureMapScreenshot();
    }

    // Show preview modal
    setScreenshot(capturedScreenshot);
    setShowPreview(true);
  };

  const handleConfirmPost = async () => {
    setIsSubmitting(true);
    setError(null);

    // Create blob URL for preview if file is selected
    const previewMediaUrl = selectedFile ? URL.createObjectURL(selectedFile) : null;
    
    // Open success modal immediately with loading state
    openSuccessPin({
      lat: coordinates!.lat,
      lng: coordinates!.lng,
      description: description.trim() || null,
      media_url: previewMediaUrl,
      status: 'loading',
    });

    // Close preview and create pin modals
    setShowPreview(false);
    onClose();

    try {
      let mediaUrl: string | null = null;

      // Upload file if selected
      if (selectedFile) {
        setIsUploading(true);
        
        // Generate unique filename - use user ID or guest ID
        const fileExt = selectedFile.name.split('.').pop();
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const accountId = user?.id || GuestAccountService.getGuestId();
        const fileName = `${accountId}/map-pins/${timestamp}-${random}.${fileExt}`;

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
          coordinates!.lat,
          coordinates!.lng
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
        lat: coordinates!.lat,
        lng: coordinates!.lng,
        description: description.trim() || null,
        media_url: mediaUrl,
        city_id: cityId,
        county_id: countyId,
        visibility: visibility,
      };

      const createdPin = await PublicMapPinService.createPin(pinData);
      onPinCreated(createdPin as CreatedPin);
      
      // Update success modal with success state
      updateSuccessPin({
        id: createdPin.id,
        status: 'success',
        media_url: createdPin.media_url,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create pin';
      console.error('[CreatePinModal] Error creating pin:', errorMessage, err);
      
      // Update success modal with error state
      updateSuccessPin({
        status: 'error',
        error: errorMessage,
      });
      
      // Also set error in form (though modal is closed)
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setScreenshot(null);
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
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          {/* Left Container - Back Button & Location */}
          <div className="flex-1 min-w-0 flex items-center">
            {onBack ? (
              <button
                onClick={() => {
                  onClose();
                  onBack();
                }}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors w-full min-w-0"
                disabled={isSubmitting || isUploading}
              >
                <ArrowLeftIcon className="w-4 h-4 flex-shrink-0" />
                <div className="text-left min-w-0 flex-1">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">Location</div>
                  <div className="text-xs font-medium text-gray-900 truncate">
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
          </div>

          {/* Center Container - Title */}
          <div className="flex-1 flex items-center justify-center">
            <h2 className="text-sm font-semibold text-gray-900">Create Pin</h2>
          </div>

          {/* Right Container - Post Button */}
          <div className="flex-1 flex items-center justify-end">
            <button
              type="submit"
              form="create-pin-form"
              disabled={isSubmitting || isUploading || isCapturingScreenshot || (!description.trim() && !selectedFile)}
              className="text-sm font-medium text-gray-900 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCapturingScreenshot ? 'Capturing...' : isUploading ? 'Uploading...' : isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>

        {/* Form - Social feed style */}
        <form id="create-pin-form" onSubmit={handleSubmit} className="px-4 pb-4">
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

          {/* Visibility Selection - Single Row */}
          <div 
            className="mb-3 flex items-center justify-between gap-3 relative"
            onMouseEnter={() => !user && setShowVisibilityTooltip(true)}
            onMouseLeave={() => setShowVisibilityTooltip(false)}
          >
            <label className="text-xs font-semibold text-gray-900">
              Visibility
            </label>
            <div className="flex items-center gap-2 relative">
              <span className={`text-xs ${visibility === 'public' ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                Public
              </span>
              <button
                type="button"
                onClick={() => setVisibility(visibility === 'public' ? 'only_me' : 'public')}
                disabled={isSubmitting || isUploading || !user}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  visibility === 'only_me' ? 'bg-blue-600' : 'bg-gray-200'
                }`}
                role="switch"
                aria-checked={visibility === 'only_me'}
                aria-label="Toggle visibility"
                title={!user ? 'Sign in to create private pins' : undefined}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    visibility === 'only_me' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-xs ${visibility === 'only_me' ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                Only Me
              </span>
              
              {/* Tooltip for guests */}
              {!user && showVisibilityTooltip && (
                <div className="absolute bottom-full right-0 mb-2 z-50 w-48 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                  <p className="text-xs text-gray-900 font-medium mb-1">
                    Sign in for private pins
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Guests can only create public pins. Sign in to create private pins that only you can see.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* City Link - Bottom of modal */}
          {locationDebug?.cityName && citySlug && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <Link
                href={`/explore/city/${citySlug}`}
                className="text-xs text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1.5"
              >
                <span>Explore {locationDebug.cityName}</span>
                <ArrowRightIcon className="w-3 h-3" />
              </Link>
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

        {/* Preview Modal */}
        <PinPreviewModal
          isOpen={showPreview}
          onClose={handleClosePreview}
          onConfirm={handleConfirmPost}
          screenshot={screenshot}
          description={description.trim() || null}
          mediaPreview={filePreview}
          isMediaVideo={selectedFile?.type.startsWith('video/') || false}
          address={address}
          isSubmitting={isSubmitting || isUploading}
        />
    </div>
  );
}

