'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';

export interface ImageUploadProps {
  value: string | string[] | null;
  onChange: (url: string | string[] | null) => void;
  onError?: (error: string | null) => void;
  bucket: 'logos' | 'cover-photos' | 'members_business_logo' | 'profile-images';
  table: string;
  column: string;
  multiple?: boolean;
  maxImages?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  onError,
  bucket,
  table,
  column,
  multiple = false,
  maxImages,
  label,
  disabled = false,
  className = '',
}: ImageUploadProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUrls: string[] | string | null = multiple 
    ? (Array.isArray(value) ? value : value ? [value] : [])
    : (typeof value === 'string' ? value : null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Wait for auth to finish loading before checking user
    if (authLoading) {
      const errorMsg = 'Please wait for authentication to load';
      setUploadError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (!user) {
      const errorMsg = 'You must be logged in to upload images';
      setUploadError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    const filesToUpload = Array.from(files);
    
    // Check max images limit
    if (multiple && maxImages) {
      const currentCount = Array.isArray(currentUrls) ? currentUrls.length : (currentUrls ? 1 : 0);
      if (currentCount + filesToUpload.length > maxImages) {
        const errorMsg = `Maximum ${maxImages} image${maxImages > 1 ? 's' : ''} allowed`;
        setUploadError(errorMsg);
        onError?.(errorMsg);
        return;
      }
    }

    // If not multiple, only take the first file
    const filesToProcess = multiple ? filesToUpload : [filesToUpload[0]];

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToProcess) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          const errorMsg = 'Please select valid image files';
          setUploadError(errorMsg);
          onError?.(errorMsg);
          setIsUploading(false);
          return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          const errorMsg = 'Images must be smaller than 5MB';
          setUploadError(errorMsg);
          onError?.(errorMsg);
          setIsUploading(false);
          return;
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${table}/${column}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          const errorMsg = `Failed to upload ${file.name}: ${uploadError.message}`;
          setUploadError(errorMsg);
          onError?.(errorMsg);
          setIsUploading(false);
          return;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }

      // Update value based on multiple mode
      if (multiple) {
        const newUrls = [...(Array.isArray(currentUrls) ? currentUrls : []), ...uploadedUrls];
        onChange(newUrls);
      } else {
        onChange(uploadedUrls[0] || null);
      }

      setUploadError(null);
      onError?.(null);
    } catch (error) {
      console.error('Error uploading image:', error);
      const errorMsg = 'Failed to upload image. Please try again.';
      setUploadError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (indexToRemove?: number) => {
    if (multiple && Array.isArray(currentUrls)) {
      const newUrls = currentUrls.filter((_, index) => index !== indexToRemove);
      onChange(newUrls.length > 0 ? newUrls : null);
    } else {
      onChange(null);
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-semibold text-black mb-2">
          {label}
        </label>
      )}

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Upload Error */}
      {uploadError && (
        <div className="mb-2 bg-red-50 border-2 border-red-200 rounded-lg p-2">
          <p className="text-xs text-red-600">{uploadError}</p>
        </div>
      )}

      {/* Multiple Images Display */}
      {multiple && Array.isArray(currentUrls) && currentUrls.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          {currentUrls.map((url, index) => (
            <div key={index} className="relative group">
              <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <Image
                  src={url}
                  alt={`Upload ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                  unoptimized={url.startsWith('data:') || url.includes('supabase.co')}
                  loading="lazy"
                />
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Single Image Display */}
      {!multiple && currentUrls && typeof currentUrls === 'string' && (
        <div className="mb-4 relative inline-block">
          <div className="relative w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
            <Image
              src={currentUrls}
              alt={label || 'Uploaded image'}
              fill
              sizes="128px"
              className="object-cover"
              unoptimized={currentUrls.startsWith('data:') || currentUrls.includes('supabase.co')}
              loading="lazy"
            />
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => handleRemove()}
              className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full"
              aria-label="Remove image"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Upload Button */}
      {!disabled && (
        <button
          type="button"
          onClick={handleClick}
          disabled={Boolean(isUploading || authLoading || (multiple && maxImages !== undefined && Array.isArray(currentUrls) && currentUrls.length >= maxImages))}
          className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gold-500 hover:bg-gold-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <div className="w-5 h-5 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold text-gray-700">Uploading...</span>
            </>
          ) : (
            <>
              <ArrowUpTrayIcon className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">
                {multiple 
                  ? `Upload Image${Array.isArray(currentUrls) && currentUrls.length > 0 ? 's' : ''}`
                  : (typeof currentUrls === 'string' && currentUrls)
                    ? 'Replace Image' 
                    : 'Upload Image'
                }
              </span>
            </>
          )}
        </button>
      )}

      {/* Helper Text */}
      {multiple && maxImages && (
        <p className="text-xs text-gray-500 mt-2">
          {Array.isArray(currentUrls) ? currentUrls.length : 0} / {maxImages} images
        </p>
      )}
      <p className="text-xs text-gray-500 mt-1">
        Max 5MB per image. Supported formats: JPEG, PNG, GIF, WebP
      </p>
    </div>
  );
}


