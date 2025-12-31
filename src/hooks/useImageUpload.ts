'use client';

import { useState, useCallback } from 'react';
import { useSupabaseClient } from './useSupabaseClient';
import { STORAGE_BUCKETS, STORAGE_CONFIG } from '@/constants/storage';

interface UseImageUploadOptions {
  bucket?: string;
  onSuccess?: (url: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Shared hook for handling image uploads to Supabase storage
 */
export function useImageUpload(options: UseImageUploadOptions = {}) {
  const { bucket = STORAGE_BUCKETS.GOV_PEOPLE, onSuccess, onError } = options;
  const supabase = useSupabaseClient();
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = useCallback((file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'Please select a valid image file';
    }
    if (file.size > STORAGE_CONFIG.MAX_FILE_SIZE) {
      return `Image must be smaller than ${STORAGE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`;
    }
    return null;
  }, []);

  const uploadImage = useCallback(async (file: File, pathPrefix: string): Promise<string> => {
    const validationError = validateFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Please sign in to upload images');
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: STORAGE_CONFIG.CACHE_CONTROL,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }

    return urlData.publicUrl;
  }, [supabase, bucket, validateFile]);

  const handleUpload = useCallback(async (file: File, pathPrefix: string) => {
    setUploading(true);
    try {
      const url = await uploadImage(file, pathPrefix);
      onSuccess?.(url);
      return url;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      onError?.(err);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [uploadImage, onSuccess, onError]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, onFileSelect: (file: File) => void) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  }, []);

  return {
    uploading,
    isDragging,
    handleUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    validateFile,
  };
}

