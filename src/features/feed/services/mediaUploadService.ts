/**
 * Media Upload Service
 * Handles file uploads, validation, and thumbnail generation
 */

import { supabase } from '@/lib/supabase';
import { generateVideoThumbnail } from '@/features/feed/utils/videoThumbnail';
import type {
  UploadedMedia,
  MediaUploadOptions,
  ThumbnailResult,
  ValidationResult,
  MediaPreview,
} from '../types';

const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_STORAGE_BUCKET = 'feed-images';

export class MediaUploadService {
  /**
   * Validate a file for upload
   */
  static validateFile(file: File, maxSize: number = DEFAULT_MAX_FILE_SIZE): ValidationResult {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      return {
        valid: false,
        error: `${file.name} is not a valid image or video file`,
      };
    }

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / 1024 / 1024);
      return {
        valid: false,
        error: `${file.name} exceeds maximum file size of ${maxSizeMB}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Create a preview from a file
   */
  static createPreview(file: File): MediaPreview {
    const blobUrl = URL.createObjectURL(file);
    return {
      url: blobUrl,
      filename: file.name,
      type: file.type,
      file,
    };
  }

  /**
   * Generate thumbnail for video file
   */
  static async generateThumbnail(videoFile: File): Promise<ThumbnailResult> {
    return generateVideoThumbnail(videoFile);
  }

  /**
   * Upload a single file to Supabase storage
   */
  static async uploadFile(
    file: File,
    userId: string,
    options: {
      storageBucket?: string;
      pathPrefix?: string;
      generateThumbnail?: boolean;
    } = {}
  ): Promise<UploadedMedia> {
    const {
      storageBucket = DEFAULT_STORAGE_BUCKET,
      pathPrefix = 'feed',
      generateThumbnail: shouldGenerateThumbnail = true,
    } = options;

    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const isVideo = file.type.startsWith('video/');

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const fileName = `${userId}/${pathPrefix}/${timestamp}-${random}.${fileExt}`;

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from(storageBucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(storageBucket).getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      throw new Error(`Failed to get URL for ${file.name}`);
    }

    // Generate thumbnail for videos
    let thumbnailUrl: string | undefined;
    if (isVideo && shouldGenerateThumbnail) {
      try {
        const thumbnail = await this.generateThumbnail(file);
        const thumbFileName = `${userId}/${pathPrefix}/thumbnails/${timestamp}-${random}.jpg`;

        const { error: thumbError } = await supabase.storage
          .from(storageBucket)
          .upload(thumbFileName, thumbnail.blob, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/jpeg',
          });

        if (!thumbError) {
          const { data: thumbUrlData } = supabase.storage
            .from(storageBucket)
            .getPublicUrl(thumbFileName);
          thumbnailUrl = thumbUrlData?.publicUrl;
        }
      } catch (err) {
        console.warn('Thumbnail generation failed:', err);
      }
    }

    return {
      url: urlData.publicUrl,
      filename: file.name,
      type: isVideo ? 'video' : 'image',
      thumbnail_url: thumbnailUrl,
      mime_type: file.type,
      size: file.size,
    };
  }

  /**
   * Upload multiple files with progress tracking
   */
  static async uploadMedia(
    files: File[],
    options: MediaUploadOptions
  ): Promise<UploadedMedia[]> {
    const {
      userId,
      storageBucket = DEFAULT_STORAGE_BUCKET,
      pathPrefix = 'feed',
      maxFileSize = DEFAULT_MAX_FILE_SIZE,
      onProgress,
    } = options;

    // Validate all files first
    for (const file of files) {
      const validation = this.validateFile(file, maxFileSize);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    const uploadedMedia: UploadedMedia[] = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const uploaded = await this.uploadFile(file, userId, {
          storageBucket,
          pathPrefix,
          generateThumbnail: true,
        });
        
        uploadedMedia.push(uploaded);
        
        // Report progress
        if (onProgress) {
          const progress = ((i + 1) / totalFiles) * 100;
          onProgress(progress);
        }
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        throw error;
      }
    }

    return uploadedMedia;
  }

  /**
   * Create previews for multiple files
   */
  static async createPreviews(files: File[]): Promise<MediaPreview[]> {
    const previews: MediaPreview[] = [];

    for (const file of files) {
      const preview = this.createPreview(file);
      
      // Generate poster for videos
      if (file.type.startsWith('video/')) {
        try {
          const thumbnail = await this.generateThumbnail(file);
          preview.poster = thumbnail.dataUrl;
        } catch (err) {
          console.warn('Thumbnail generation failed for preview:', err);
        }
      }
      
      previews.push(preview);
    }

    return previews;
  }

  /**
   * Revoke blob URLs to free memory
   */
  static revokeBlobUrls(previews: MediaPreview[]): void {
    previews.forEach((preview) => {
      if (preview.url?.startsWith('blob:')) {
        URL.revokeObjectURL(preview.url);
      }
    });
  }
}


