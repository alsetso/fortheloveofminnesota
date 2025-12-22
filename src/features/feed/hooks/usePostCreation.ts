/**
 * usePostCreation Hook
 * Manages post creation state and submission flow
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { PostService } from '../services/postService';
import { MediaUploadService } from '../services/mediaUploadService';
import type {
  CreatePostData,
  PostVisibility,
  MediaPreview,
  UploadedMedia,
  UploadProgress,
} from '../types';

export interface UsePostCreationOptions {
  accountId?: string;
  profileId?: string;
  city?: string;
  county?: string;
  state?: string;
  zip?: string;
  full_address?: string;
  initialMedia?: MediaPreview[];
  onPostCreated?: () => void;
}

export interface UsePostCreationReturn {
  // Form state
  title: string;
  content: string;
  visibility: PostVisibility;
  media: MediaPreview[];
  
  // UI state
  isSubmitting: boolean;
  uploadProgress: UploadProgress;
  error: string | null;
  
  // Actions
  setTitle: (title: string) => void;
  setContent: (content: string) => void;
  setVisibility: (visibility: PostVisibility) => void;
  setMedia: (media: MediaPreview[]) => void;
  addMedia: (previews: MediaPreview[]) => void;
  removeMedia: (index: number) => void;
  submit: () => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

export function usePostCreation(
  options: UsePostCreationOptions = {}
): UsePostCreationReturn {
  const { user } = useAuth();
  const {
    accountId,
    profileId,
    city,
    county,
    state,
    zip,
    full_address,
    initialMedia = [],
    onPostCreated,
  } = options;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [media, setMedia] = useState<MediaPreview[]>(initialMedia);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: 'idle',
    progress: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // Update media when initialMedia changes
  useEffect(() => {
    if (initialMedia.length > 0) {
      setMedia(initialMedia);
    }
  }, [initialMedia]);

  const addMedia = useCallback((newPreviews: MediaPreview[]) => {
    setMedia((prev) => [...prev, ...newPreviews]);
  }, []);

  const removeMedia = useCallback((index: number) => {
    const mediaToRemove = media[index];
    if (mediaToRemove?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(mediaToRemove.url);
    }
    setMedia((prev) => prev.filter((_, i) => i !== index));
  }, [media]);

  const submit = useCallback(async () => {
    if (!user) {
      throw new Error('User must be authenticated to create posts');
    }

    if (!title.trim() || !content.trim()) {
      throw new Error('Title and content are required');
    }

    if (!accountId && !profileId) {
      throw new Error('Either accountId or profileId must be provided');
    }

    setIsSubmitting(true);
    setError(null);
    setUploadProgress({ stage: 'idle', progress: 0 });

    try {
      // Upload media files if any
      let uploadedMedia: UploadedMedia[] = [];
      const mediaFiles = media.filter((m): m is MediaPreview & { file: File } => !!m.file).map((m) => m.file);

      if (mediaFiles.length > 0) {
        setUploadProgress({ stage: 'uploading', progress: 0 });

        uploadedMedia = await MediaUploadService.uploadMedia(mediaFiles, {
          userId: user.id,
          onProgress: (progress) => {
            setUploadProgress({
              stage: 'uploading',
              progress: progress * 0.8, // 80% for upload, 20% for submission
            });
          },
        });
      }

      // Include already uploaded media (from MediaUploadEditor flow)
      const existingMedia = media
        .filter((m) => !m.file && m.url && !m.url.startsWith('blob:'))
        .map((m) => ({
          url: m.url,
          filename: m.filename,
          type: m.type.startsWith('video/') ? ('video' as const) : ('image' as const),
          poster: m.poster,
        }));

      uploadedMedia = [...uploadedMedia, ...existingMedia];

      // Submit post
      setUploadProgress({ stage: 'submitting', progress: 85 });

      const postData: CreatePostData = {
        title: title.trim(),
        content: content.trim(),
        visibility,
        media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
        ...(accountId && { account_id: accountId }),
        ...(profileId && { profile_id: profileId }),
        ...(city && { city }),
        ...(county && { county }),
        ...(state && { state }),
        ...(zip && { zip }),
        ...(full_address && { full_address }),
      };

      await PostService.createPost(postData);

      setUploadProgress({ stage: 'complete', progress: 100 });

      // Small delay to show completion
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Cleanup blob URLs
      MediaUploadService.revokeBlobUrls(media);

      // Reset form
      setTitle('');
      setContent('');
      setMedia([]);
      setVisibility('public');
      setUploadProgress({ stage: 'idle', progress: 0 });

      onPostCreated?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create post';
      setError(errorMessage);
      setUploadProgress({ stage: 'idle', progress: 0 });
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, title, content, visibility, media, accountId, profileId, city, county, state, zip, full_address, onPostCreated]);

  const reset = useCallback(() => {
    MediaUploadService.revokeBlobUrls(media);
    setTitle('');
    setContent('');
    setMedia([]);
    setVisibility('public');
    setError(null);
    setUploadProgress({ stage: 'idle', progress: 0 });
    setIsSubmitting(false);
  }, [media]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    title,
    content,
    visibility,
    media,
    isSubmitting,
    uploadProgress,
    error,
    setTitle,
    setContent,
    setVisibility,
    setMedia,
    addMedia,
    removeMedia,
    submit,
    reset,
    clearError,
  };
}

