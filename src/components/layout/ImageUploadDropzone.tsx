'use client';

import { useState, useRef, useCallback } from 'react';
import { ArrowUpTrayIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';

interface ImageUploadDropzoneProps {
  onImageSelected: (file: File, preview: string) => void;
  onError?: (error: string) => void;
  maxSize?: number; // in bytes, default 5MB
}

export default function ImageUploadDropzone({
  onImageSelected,
  onError,
  maxSize = 5 * 1024 * 1024, // 5MB default
}: ImageUploadDropzoneProps) {
  const { user } = useAuthStateSafe();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasRejection, setHasRejection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!user) {
      return 'Please sign in to upload images';
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return 'Please select a valid image file';
    }

    // Validate file size
    if (file.size > maxSize) {
      return `Image must be smaller than ${Math.round(maxSize / 1024 / 1024)}MB`;
    }

    return null;
  };

  const processFile = useCallback(async (file: File) => {
    const error = validateFile(file);
    if (error) {
      setHasRejection(true);
      onError?.(error);
      return;
    }

    setHasRejection(false);
    setIsProcessing(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        onImageSelected(file, preview);
        setIsProcessing(false);
      };
      reader.onerror = () => {
        onError?.('Failed to read image file');
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to process image');
      setIsProcessing(false);
    }
  }, [user, maxSize, onImageSelected, onError]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFile]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleClick = useCallback(() => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  }, [isProcessing]);

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isProcessing}
      />

      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative w-full border-2 border-dashed rounded-md p-8
          transition-all cursor-pointer
          ${isDragging
            ? 'border-gray-900 bg-gray-50'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="flex flex-col items-center justify-center gap-3">
          {isProcessing ? (
            <>
              <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium text-gray-600">Processing image...</p>
            </>
          ) : (
            <>
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center
                ${isDragging ? 'bg-gray-900' : 'bg-gray-100'}
                transition-colors
              `}>
                {isDragging ? (
                  <ArrowUpTrayIcon className="w-6 h-6 text-white" />
                ) : (
                  <PhotoIcon className="w-6 h-6 text-gray-600" />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  {isDragging ? 'Drop image here' : 'Upload an image'}
                </p>
                <p className="text-xs text-gray-500">
                  Drag and drop or click to select
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {hasRejection && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Max {Math.round(maxSize / 1024 / 1024)}MB. Supported: JPEG, PNG, GIF, WebP
        </p>
      )}
    </div>
  );
}
