'use client';

import { useRef, type ChangeEvent } from 'react';
import { useImageUpload } from '@/hooks/useImageUpload';
import { STORAGE_BUCKETS } from '@/constants/storage';

interface ImageUploadProps {
  currentUrl?: string | null;
  pathPrefix: string;
  onUpload: (url: string) => void;
  onError?: (error: Error) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-20 h-20',
  lg: 'w-24 h-24',
};

/**
 * Reusable image upload component with drag-and-drop support
 */
export default function ImageUpload({
  currentUrl,
  pathPrefix,
  onUpload,
  onError,
  size = 'md',
  className = '',
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    uploading,
    isDragging,
    handleUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useImageUpload({
    bucket: STORAGE_BUCKETS.GOV_PEOPLE,
    onSuccess: onUpload,
    onError: onError || ((err) => alert(`Failed to upload image: ${err.message}`)),
  });

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await handleUpload(file, pathPrefix);
      } catch (error) {
        // Error handled by onError callback
      }
    }
  };

  const handleClick = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e, (file) => handleUpload(file, pathPrefix).catch(() => {}))}
      onClick={handleClick}
      className={`relative ${sizeClasses[size]} border-2 border-dashed rounded cursor-pointer transition-colors ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
      } ${uploading ? 'opacity-50 pointer-events-none' : ''} ${className}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      {currentUrl ? (
        <img
          src={currentUrl}
          alt="Upload preview"
          className="w-full h-full object-cover rounded"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[10px] text-gray-400 text-center px-1">Drop or click</span>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <span className="text-[10px] text-gray-600">Uploading...</span>
        </div>
      )}
    </div>
  );
}

