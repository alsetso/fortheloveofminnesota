'use client';

import { useState, useEffect, useMemo, type FormEvent, type ChangeEvent } from 'react';
import { PhotoIcon, MapPinIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { Account } from '@/features/auth';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import PostMapModal, { PostMapData } from './PostMapModal';
import PostMapRenderer from './PostMapRenderer';
import { generateMapStaticImageUrl } from '../utils/mapStaticImage';

interface PostPublisherModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onPostCreated?: () => void;
  initialMedia?: Array<{ url: string; filename: string; type?: string; thumbnail_url?: string }>;
  initialFiles?: File[];
  initialMapData?: PostMapData | null;
  onBackToMedia?: () => void;
}

export default function PostPublisherModal({
  isOpen,
  onClose,
  account,
  onPostCreated,
  initialMedia = [],
  initialFiles = [],
  initialMapData,
  onBackToMedia,
}: PostPublisherModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'draft'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'submitting' | 'complete'>('idle');
  const [images, setImages] = useState<Array<{ url: string; filename: string; type?: string; poster?: string }>>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [mapData, setMapData] = useState<PostMapData | null>(initialMapData || null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapModalMode, setMapModalMode] = useState<'pin' | 'area'>('pin');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialMedia.length > 0) {
      // Set initial media when modal opens with media from upload editor
      setImages(initialMedia.map(media => ({
        url: media.url,
        filename: media.filename,
        type: media.type,
        poster: media.thumbnail_url,
      })));
      // Set initial files if provided
      if (initialFiles.length > 0) {
        setImageFiles(initialFiles);
      }
    }
    if (isOpen && initialMapData) {
      setMapData(initialMapData);
    }
    if (!isOpen) {
      // Reset form when modal closes
      setTitle('');
      setContent('');
      setImages([]);
      setImageFiles([]);
      setMapData(null);
      setVisibility('public');
      setError(null);
      setUploadProgress(0);
      setUploadStage('idle');
    }
  }, [isOpen, initialMedia, initialFiles, initialMapData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Simple posts - just use content as-is
    const finalContent = content;
    
    if (!finalContent.trim() || isSubmitting || !user || !account) return;

    setIsSubmitting(true);
    setError(null);
    setUploadProgress(0);
    setUploadStage('idle');

    try {
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        setError('Please sign in to create posts');
        setIsSubmitting(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session expired. Please refresh the page');
        setIsSubmitting(false);
        return;
      }

      // Upload image files to Supabase storage (images only for now)
      const uploadedImages: Array<{ url: string; filename: string; type: string }> = [];
      const totalFiles = imageFiles.filter(f => f.type.startsWith('image/')).length;
      
      if (imageFiles.length > 0) {
        setUploadStage('uploading');
        let uploadedCount = 0;
        
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const isImage = file.type.startsWith('image/');
          
          if (!isImage) continue;

          const fileExt = file.name.split('.').pop();
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(7);
          const fileName = `${user.id}/feed/${timestamp}-${random}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('feed-images')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
          }

          const { data: urlData } = supabase.storage
            .from('feed-images')
            .getPublicUrl(fileName);

          if (!urlData?.publicUrl) {
            throw new Error(`Failed to get URL for ${file.name}`);
          }

          uploadedImages.push({
            url: urlData.publicUrl,
            filename: file.name,
            type: file.type, // e.g., 'image/jpeg', 'image/png'
          });

          uploadedCount++;
          const fileUploadProgress = (uploadedCount / totalFiles) * 80;
          setUploadProgress(fileUploadProgress);
        }
      }

      setUploadStage('submitting');
      setUploadProgress(85);

      // Parse address fields from map data
      const addressFields: {
        city?: string;
        state?: string;
        zip?: string;
        county?: string;
        full_address?: string;
      } = {};

      // Extract address from map data if available (reverse geocoding data)
      if (mapData?.address) {
        addressFields.full_address = mapData.address;
        if (mapData.city) addressFields.city = mapData.city;
        if (mapData.state) addressFields.state = mapData.state;
        if (mapData.zip) addressFields.zip = mapData.zip;
        if (mapData.county) addressFields.county = mapData.county;
      }

      const response = await fetch('/api/feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          // Title is optional - use provided title or auto-generate from content if not provided
          ...(title.trim() 
            ? { title: title.trim().substring(0, 200) }
            : finalContent.trim() && { title: finalContent.trim().split('\n')[0].substring(0, 200) }
          ),
          content: finalContent.trim(),
          images: uploadedImages,
          visibility,
          account_id: account.id,
          type: 'simple',
          ...addressFields,
          ...(mapData && { map_data: mapData }),
        }),
      });

      setUploadProgress(95);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create post' }));
        console.error('Post creation error response:', errorData);
        const errorMessage = errorData.details || errorData.message || errorData.error || 'Failed to create post';
        throw new Error(errorMessage);
      }

      setUploadProgress(100);
      setUploadStage('complete');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Revoke blob URLs
      images.forEach(img => {
        if (img.url?.startsWith('blob:')) {
          URL.revokeObjectURL(img.url);
        }
      });

      // Reset and close
      setTitle('');
      setContent('');
      setImages([]);
      setImageFiles([]);
      setVisibility('public');
      setUploadProgress(0);
      setUploadStage('idle');
      onPostCreated?.();
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
      setError(error instanceof Error ? error.message : 'Failed to create post');
      setTimeout(() => setError(null), 3000);
      setUploadProgress(0);
      setUploadStage('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      // Reset input value to allow re-selecting the same file
      e.target.value = '';
      return;
    }

    // Filter to only images
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    const nonImageFiles = Array.from(files).filter(f => !f.type.startsWith('image/'));
    
    // Show error if non-image files were selected
    if (nonImageFiles.length > 0) {
      setError(`Only image files are allowed. ${nonImageFiles.length} file(s) were rejected.`);
      setTimeout(() => setError(null), 3000);
    }
    
    if (imageFiles.length === 0) {
      // Reset input value to allow re-selecting the same file
      e.target.value = '';
      return;
    }

    setImageFiles(prev => [...prev, ...imageFiles]);

    const newImages = imageFiles.map((file) => {
      const blobUrl = URL.createObjectURL(file);
      return {
        url: blobUrl,
        filename: file.name,
        type: file.type, // e.g., 'image/jpeg', 'image/png'
      };
    });

    setImages(prev => [...prev, ...newImages]);
    
    // Reset input value to allow re-selecting the same file
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const imageToRemove = images[index];
    if (imageToRemove?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    setImages(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const displayName = account 
    ? `${account.first_name || ''} ${account.last_name || ''}`.trim() || 'User'
    : 'User';

  // Check if we have valid content
  const hasContent = content.trim().length > 0;
  const canPost = hasContent && !isSubmitting && account;

  // Generate static map image URL - recalculates when mapData changes
  // Must be called before early return to satisfy hooks rules
  const staticMapImageUrl = useMemo(() => {
    if (!mapData) return null;
    return generateMapStaticImageUrl(mapData, {
      width: 600,
      height: 300,
    });
  }, [mapData]);

  // Create a key for the image to force reload when mapData changes
  // Must be called before early return to satisfy hooks rules
  const mapImageKey = useMemo(() => {
    if (!mapData) return null;
    // Create a stable key from mapData to force image reload on changes
    return JSON.stringify(mapData);
  }, [mapData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-2">
      <div className="bg-white rounded-md border border-gray-200 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ProfilePhoto account={account} size="sm" />
            <div className="flex flex-col">
              <button
                type="button"
                className="text-left text-sm font-semibold text-gray-900 hover:underline flex items-center gap-1"
              >
                {displayName}
                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
              </button>
              <button
                type="button"
                onClick={() => {
                  // Toggle visibility - for now just show public
                  setVisibility(visibility === 'public' ? 'draft' : 'public');
                }}
                className="text-left text-xs text-gray-600 hover:underline flex items-center gap-1"
              >
                {visibility === 'public' ? 'Post to Anyone' : 'Save as Draft'}
                <ChevronDownIcon className="w-2.5 h-2.5 text-gray-400" />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isSubmitting}
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-[10px] space-y-3">
          {error && (
            <div className="px-[10px] py-[10px] bg-red-50 border border-red-200 text-red-700 rounded-md text-xs">
              {error}
            </div>
          )}

          {/* Upload Progress */}
          {(uploadStage === 'uploading' || uploadStage === 'submitting' || uploadStage === 'complete') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium">
                  {uploadStage === 'uploading' && 'Uploading files...'}
                  {uploadStage === 'submitting' && 'Creating post...'}
                  {uploadStage === 'complete' && 'Post created!'}
                </span>
                <span className="text-gray-500">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-md h-1.5 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 ease-out rounded-md"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Title */}
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full min-h-[32px] px-[10px] py-[10px] text-sm font-semibold border-none resize-none focus:outline-none placeholder:text-gray-400 bg-transparent"
            rows={1}
          />

          {/* Content */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want to talk about?"
            className="w-full min-h-[80px] px-[10px] py-[10px] text-xs border-none resize-none focus:outline-none placeholder:text-gray-400 bg-transparent"
            required
          />

          {/* Compact Media Preview - Below Caption */}
          {images.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                  Media ({images.length})
                </span>
                {onBackToMedia && (
                  <button
                    type="button"
                    onClick={onBackToMedia}
                    className="text-[10px] text-gray-600 hover:text-gray-900 font-medium transition-colors"
                  >
                    Change
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {images.map((image, idx) => (
                  <div key={idx} className="relative w-[80px] h-[80px] bg-gray-100 rounded-md border border-gray-200 overflow-hidden group flex-shrink-0">
                    <img 
                      src={image.url} 
                      alt={`Preview ${idx + 1}`} 
                      className="w-full h-full object-cover" 
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      aria-label="Remove"
                    >
                      <XMarkIcon className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map Section - Always visible */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                {mapData 
                  ? `Map (${mapData.type === 'pin' ? 'Pin' : mapData.type === 'both' ? 'Pin + Area' : 'Area'})`
                  : 'Map'
                }
              </span>
              <button
                type="button"
                onClick={() => {
                  if (mapData) {
                    setMapModalMode(mapData.type === 'area' ? 'area' : 'pin');
                  }
                  setShowMapModal(true);
                }}
                className="text-[10px] text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                {mapData ? 'Edit' : 'Add Map'}
              </button>
            </div>
            {mapData ? (
              <PostMapRenderer
                mapData={mapData}
                height="150px"
                onClick={() => {
                  setMapModalMode(mapData.type === 'area' ? 'area' : 'pin');
                  setShowMapModal(true);
                }}
              />
            ) : (
              <div 
                className="relative w-full h-[150px] border border-dashed border-gray-200 rounded-md overflow-hidden bg-gray-50 hover:border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center"
                onClick={() => {
                  setMapModalMode('pin');
                  setShowMapModal(true);
                }}
              >
                <div className="flex flex-col items-center gap-1.5 text-gray-500">
                  <MapPinIcon className="w-4 h-4" />
                  <span className="text-xs font-medium">Click to add map</span>
                </div>
              </div>
            )}
          </div>

          {/* Debug Accordion - Address Autodetection Info */}
          {mapData && (mapData.address || mapData.city || mapData.state || mapData.zip || mapData.debugInfo) && (
            <div className="bg-gray-50 rounded-md border border-gray-200 overflow-hidden">
              <AddressDebugAccordionContent mapData={mapData} />
            </div>
          )}

          </div>

          {/* Footer with actions */}
          <div className="border-t border-gray-200 p-[10px]">
            <div className="flex items-center justify-between">
              {/* Left side - Action icons with labels */}
              <div className="flex items-center gap-2">
                <label className={`flex items-center gap-1.5 px-[10px] py-[10px] rounded-md cursor-pointer transition-colors ${
                  images.length > 0
                    ? 'text-green-600 hover:bg-green-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}>
                  <PhotoIcon className="w-3 h-3" />
                  <span className="text-xs font-medium">Media</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMapModalMode('pin');
                    setShowMapModal(true);
                  }}
                  className={`flex items-center gap-1.5 px-[10px] py-[10px] rounded-md transition-colors ${
                    mapData
                      ? 'text-green-600 hover:bg-green-50'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <MapPinIcon className="w-3 h-3" />
                  <span className="text-xs font-medium">Map</span>
                </button>
              </div>

              {/* Right side - Post button */}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!canPost}
                  className="px-3 py-[10px] bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {showMapModal && (
        <PostMapModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          initialMapData={mapData}
          mode={mapModalMode}
          onSave={(newMapData) => {
            setMapData(newMapData);
            setShowMapModal(false);
          }}
        />
      )}
    </div>
  );
}

// Debug Accordion Component for Address Autodetection
function AddressDebugAccordionContent({ mapData }: { mapData: PostMapData }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!mapData.debugInfo && !mapData.address && !mapData.city && !mapData.state && !mapData.zip) {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-[10px] py-[10px] hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">Debug: Address Autodetection</span>
          {mapData.debugInfo?.error && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">Error</span>
          )}
        </div>
        <ChevronDownIcon
          className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="px-[10px] pb-[10px] space-y-3 border-t border-gray-200">
          {/* Detected Address Fields */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Detected Address</h4>
            <div className="space-y-1.5">
              {mapData.address && (
                <div className="p-[10px] bg-white rounded-md border border-gray-200">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Full Address</div>
                  <div className="text-xs text-gray-900 font-mono">{mapData.address}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {mapData.city && (
                  <div className="p-[10px] bg-white rounded-md border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">City</div>
                    <div className="text-xs text-gray-900">{mapData.city}</div>
                  </div>
                )}
                {mapData.state && (
                  <div className="p-[10px] bg-white rounded-md border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">State</div>
                    <div className="text-xs text-gray-900">{mapData.state}</div>
                  </div>
                )}
                {mapData.zip && (
                  <div className="p-[10px] bg-white rounded-md border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">ZIP</div>
                    <div className="text-xs text-gray-900">{mapData.zip}</div>
                  </div>
                )}
                {mapData.county && (
                  <div className="p-[10px] bg-white rounded-md border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">County</div>
                    <div className="text-xs text-gray-900">{mapData.county}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Debug Information */}
          {mapData.debugInfo && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Debug Info</h4>
              <div className="space-y-1.5">
                <div className="p-[10px] bg-white rounded-md border border-gray-200">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Source</div>
                  <div className="text-xs text-gray-900 font-mono">{mapData.debugInfo.source}</div>
                </div>
                {mapData.debugInfo.coordinates && (
                  <div className="p-[10px] bg-white rounded-md border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Coordinates</div>
                    <div className="text-xs text-gray-900 font-mono">
                      [{mapData.debugInfo.coordinates[0].toFixed(6)}, {mapData.debugInfo.coordinates[1].toFixed(6)}]
                    </div>
                  </div>
                )}
                {mapData.debugInfo.timestamp && (
                  <div className="p-[10px] bg-white rounded-md border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Timestamp</div>
                    <div className="text-xs text-gray-900 font-mono">
                      {new Date(mapData.debugInfo.timestamp).toLocaleString()}
                    </div>
                  </div>
                )}
                {mapData.debugInfo.error && (
                  <div className="p-[10px] bg-red-50 rounded-md border border-red-200">
                    <div className="text-xs font-medium text-red-700 uppercase tracking-wide mb-0.5">Error</div>
                    <div className="text-xs text-red-800 font-mono">{mapData.debugInfo.error}</div>
                  </div>
                )}
                {mapData.debugInfo.geocodingResponse && (
                  <div className="p-[10px] bg-white rounded-md border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Geocoding Response</div>
                    <pre className="text-xs text-gray-900 font-mono overflow-x-auto max-h-32 overflow-y-auto">
                      {JSON.stringify(mapData.debugInfo.geocodingResponse, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


