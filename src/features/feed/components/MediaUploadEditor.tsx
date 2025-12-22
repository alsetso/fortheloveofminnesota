'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PhotoIcon, VideoCameraIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Account } from '@/features/auth';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';
import { ModalNav } from '@/components/ui/ModalNav';

interface MediaUploadEditorProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onUploadComplete?: () => void;
  onMediaReady?: (media: Array<{ url: string; filename: string; type: string; thumbnail_url?: string }>, files: File[]) => void;
  initialFiles?: File[];
  initialPreviews?: Array<{ url: string; file: File; type: string; poster?: string }>;
}

export default function MediaUploadEditor({
  isOpen,
  onClose,
  account,
  onUploadComplete,
  onMediaReady,
  initialFiles = [],
  initialPreviews = [],
}: MediaUploadEditorProps) {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Array<{ url: string; file: File; type: string; poster?: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<'select' | 'preview' | 'uploading' | 'complete'>('select');
  const [isDragging, setIsDragging] = useState(false);
  const previewsRef = useRef<Array<{ url: string; file: File; type: string; poster?: string }>>([]);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Restore initial files/previews if provided
      if (initialFiles.length > 0) {
        setFiles(initialFiles);
        // Recreate previews from files if initialPreviews not provided or URLs are stale
        if (initialPreviews.length > 0 && initialPreviews.length === initialFiles.length) {
          // Use provided previews if available
          setPreviews(initialPreviews);
        } else {
          const newPreviews = initialFiles.map(async (file) => {
            const blobUrl = URL.createObjectURL(file);
            const isVideo = file.type.startsWith('video/');
            let poster: string | undefined;
            if (isVideo) {
              try {
                const { generateVideoThumbnail } = await import('./utils/videoThumbnail');
                const result = await generateVideoThumbnail(file);
                poster = result.dataUrl;
              } catch (err) {
                console.warn('Thumbnail generation failed:', err);
              }
            }
            return {
              url: blobUrl,
              file,
              type: file.type,
              poster,
            };
          });
          Promise.all(newPreviews).then(setPreviews);
        }
        setStage('preview');
      } else {
        setFiles([]);
        setPreviews([]);
        setStage('select');
      }
      setError(null);
      setUploadProgress(0);
    } else {
      // Cleanup blob URLs when modal closes
      const currentPreviews = previewsRef.current;
      currentPreviews.forEach(preview => {
        if (preview.url?.startsWith('blob:')) {
          URL.revokeObjectURL(preview.url);
        }
      });
      // Reset when modal closes
      setFiles([]);
      setPreviews([]);
      previewsRef.current = [];
      setError(null);
      setUploadProgress(0);
      setStage('select');
    }
  }, [isOpen, initialFiles, initialPreviews]);
  
  // Keep ref in sync with previews
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  const validateAndAddFiles = useCallback((fileList: File[]) => {
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
    
    const errors: string[] = [];
    const validFiles: File[] = [];
    
    fileList.forEach(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      // Check file type
      if (!isImage && !isVideo) {
        errors.push(`${file.name}: Invalid file type. Only images and videos are allowed.`);
        return;
      }
      
      // Check file size
      if (isImage && file.size > MAX_IMAGE_SIZE) {
        errors.push(`${file.name}: Image too large. Maximum size is 10MB.`);
        return;
      }
      
      if (isVideo && file.size > MAX_VIDEO_SIZE) {
        errors.push(`${file.name}: Video too large. Maximum size is 100MB.`);
        return;
      }
      
      validFiles.push(file);
    });

    if (errors.length > 0) {
      setError(errors.join(' '));
      setTimeout(() => setError(null), 5000);
    }

    if (validFiles.length === 0) {
      if (errors.length === 0) {
        setError('Please select image or video files');
        setTimeout(() => setError(null), 3000);
      }
      return;
    }

    setFiles(prev => [...prev, ...validFiles]);

    const newPreviews = validFiles.map(async (file) => {
      const blobUrl = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/');
      
      let poster: string | undefined;
      if (isVideo) {
        try {
          const { generateVideoThumbnail } = await import('./utils/videoThumbnail');
          const result = await generateVideoThumbnail(file);
          poster = result.dataUrl;
        } catch (err) {
          console.warn('Thumbnail generation failed:', err);
        }
      }
      
      return {
        url: blobUrl,
        file,
        type: file.type,
        poster,
      };
    });

    Promise.all(newPreviews).then(previewResults => {
      setPreviews(prev => [...prev, ...previewResults]);
      setStage('preview');
    });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    validateAndAddFiles(Array.from(selectedFiles));
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    validateAndAddFiles(droppedFiles);
  }, [validateAndAddFiles]);

  const removeFile = (index: number) => {
    const previewToRemove = previews[index];
    if (previewToRemove?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(previewToRemove.url);
    }
    const newPreviews = previews.filter((_, i) => i !== index);
    const newFiles = files.filter((_, i) => i !== index);
    setPreviews(newPreviews);
    setFiles(newFiles);
    if (newPreviews.length === 0) {
      setStage('select');
    }
  };

  const handleContinue = async () => {
    if (!user || !account || files.length === 0) return;

    // If onMediaReady callback exists, pass files directly without uploading
    if (onMediaReady) {
      // Create preview objects to pass back
      const mediaToPass = previews.map((preview) => ({
        url: preview.url,
        filename: preview.file.name,
        type: preview.type,
      }));
      
      onMediaReady(mediaToPass, files);
      onClose();
      return;
    }

    // Otherwise, upload and create post (legacy behavior)
    setIsUploading(true);
    setStage('uploading');
    setError(null);
    setUploadProgress(0);

    try {
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        throw new Error('Please sign in to upload media');
      }

      const uploadedMedia: Array<{ url: string; filename: string; type: string; thumbnail_url?: string }> = [];
      const totalFiles = files.length;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith('video/');

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

        let thumbnailUrl: string | undefined;
        
        if (isVideo) {
          try {
            const { generateVideoThumbnail } = await import('./utils/videoThumbnail');
            const thumbnail = await generateVideoThumbnail(file);
            
            const thumbFileName = `${user.id}/feed/thumbnails/${timestamp}-${random}.jpg`;
            const { error: thumbError } = await supabase.storage
              .from('feed-images')
              .upload(thumbFileName, thumbnail.blob, {
                cacheControl: '3600',
                upsert: false,
                contentType: 'image/jpeg',
              });

            if (!thumbError) {
              const { data: thumbUrlData } = supabase.storage
                .from('feed-images')
                .getPublicUrl(thumbFileName);
              thumbnailUrl = thumbUrlData?.publicUrl;
            }
          } catch (err) {
            console.warn('Thumbnail upload failed:', err);
          }
        }

        uploadedMedia.push({
          url: urlData.publicUrl,
          filename: file.name,
          type: file.type,
          thumbnail_url: thumbnailUrl,
        });

        setUploadProgress(((i + 1) / totalFiles) * 100);
      }

      const hasVideo = uploadedMedia.some(m => m.type === 'video');
      const hasImage = uploadedMedia.some(m => m.type === 'image');
      const postTitle = hasVideo && hasImage ? 'Media post' : hasVideo ? 'Video post' : 'Photo post';

      const response = await fetch('/api/feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: postTitle,
          content: '',
          images: uploadedMedia,
          visibility: 'members_only',
          account_id: account.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create post' }));
        throw new Error(errorData.error || 'Failed to create post');
      }

      setStage('complete');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Cleanup
      previews.forEach(preview => {
        if (preview.url?.startsWith('blob:')) {
          URL.revokeObjectURL(preview.url);
        }
      });

      onUploadComplete?.();
      onClose();
    } catch (error) {
      console.error('Error uploading media:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload media');
      setStage('preview');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <ModalNav
          title="Add Media"
          onClose={onClose}
          disabled={isUploading}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          {/* Upload Progress */}
          {stage === 'uploading' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700 font-medium">Uploading...</span>
                <span className="text-gray-500 font-medium">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gold-500 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Drop Zone - Show when no files selected */}
          {stage === 'select' && (
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all duration-200 ${
                isDragging
                  ? 'border-gold-500 bg-gold-50'
                  : 'border-gray-300 hover:border-gold-400 hover:bg-gold-50/30'
              } cursor-pointer group`}
            >
              <label className="cursor-pointer block">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <PhotoIcon className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors ${
                    isDragging ? 'text-gold-600' : 'text-gray-400 group-hover:text-gold-600'
                  }`} />
                  <VideoCameraIcon className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors ${
                    isDragging ? 'text-gold-600' : 'text-gray-400 group-hover:text-gold-600'
                  }`} />
                </div>
                <p className="text-gray-700 font-medium mb-1.5 text-sm sm:text-base">
                  {isDragging ? 'Drop files here' : 'Click or drag to upload media'}
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  Images (JPG, PNG, GIF) up to 10MB • Videos (MP4, MOV, AVI) up to 100MB
                </p>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>
          )}

          {/* Previews */}
          {stage === 'preview' && previews.length > 0 && (
            <div className="space-y-4">
              <div className={`grid gap-3 ${previews.length === 1 ? 'grid-cols-1' : previews.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {previews.map((preview, idx) => (
                  <div key={idx} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden group">
                    {preview.type.startsWith('video/') ? (
                      <video 
                        src={preview.url}
                        poster={preview.poster}
                        className="w-full h-full object-cover" 
                        controls={false}
                        playsInline
                        preload="metadata"
                        muted
                      />
                    ) : (
                      <img 
                        src={preview.url} 
                        alt={`Preview ${idx + 1}`} 
                        className="w-full h-full object-cover" 
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                      disabled={isUploading}
                      aria-label="Remove"
                    >
                      <XMarkIcon className="w-4 h-4 text-white" />
                    </button>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*,video/*';
                  input.multiple = true;
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files) {
                      validateAndAddFiles(Array.from(target.files));
                    }
                  };
                  input.click();
                }}
                className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                disabled={isUploading}
              >
                Add more media
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white rounded-lg transition-colors"
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={previews.length === 0 || isUploading}
            className="px-5 py-2 text-sm font-semibold bg-gold-600 hover:bg-gold-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isUploading ? 'Uploading...' : onMediaReady ? 'Continue' : 'Upload & Post'}
          </button>
        </div>
      </div>
    </div>
  );
}


