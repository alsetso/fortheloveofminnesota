/**
 * Video Thumbnail Generation Utility
 * @enterprise-grade Generates high-quality thumbnails from video files
 */

export interface VideoThumbnailOptions {
  /**
   * Time in seconds to capture thumbnail (default: 1)
   */
  captureTime?: number;
  /**
   * Maximum width of thumbnail (default: 1280)
   */
  maxWidth?: number;
  /**
   * Maximum height of thumbnail (default: 720)
   */
  maxHeight?: number;
  /**
   * JPEG quality (0-1, default: 0.8)
   */
  quality?: number;
  /**
   * Output format (default: 'image/jpeg')
   */
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface VideoThumbnailResult {
  /**
   * Blob containing the thumbnail image
   */
  blob: Blob;
  /**
   * Data URL of the thumbnail
   */
  dataUrl: string;
  /**
   * Width of the thumbnail
   */
  width: number;
  /**
   * Height of the thumbnail
   */
  height: number;
  /**
   * Video duration in seconds
   */
  duration: number;
}

/**
 * Generate thumbnail from video file
 * @param videoFile - Video file to generate thumbnail from
 * @param options - Thumbnail generation options
 * @returns Promise resolving to thumbnail result
 */
export async function generateVideoThumbnail(
  videoFile: File,
  options: VideoThumbnailOptions = {}
): Promise<VideoThumbnailResult> {
  const {
    captureTime = 1,
    maxWidth = 1280,
    maxHeight = 720,
    quality = 0.8,
    format = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    // Create video element
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    // Create object URL for video
    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;

    // Handle video load errors
    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Failed to load video for thumbnail generation'));
    };

    // Generate thumbnail when metadata is loaded
    video.onloadedmetadata = () => {
      // Calculate capture time (ensure it's within video duration)
      const seekTime = Math.min(captureTime, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    // Capture frame when seeked to correct time
    video.onseeked = () => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        // Calculate dimensions maintaining aspect ratio
        let { videoWidth, videoHeight } = video;
        
        // Scale down if necessary
        if (videoWidth > maxWidth || videoHeight > maxHeight) {
          const widthRatio = maxWidth / videoWidth;
          const heightRatio = maxHeight / videoHeight;
          const scale = Math.min(widthRatio, heightRatio);
          
          videoWidth = Math.floor(videoWidth * scale);
          videoHeight = Math.floor(videoHeight * scale);
        }

        // Set canvas dimensions
        canvas.width = videoWidth;
        canvas.height = videoHeight;

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            // Clean up
            URL.revokeObjectURL(videoUrl);

            if (!blob) {
              reject(new Error('Failed to create thumbnail blob'));
              return;
            }

            // Convert to data URL
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                blob,
                dataUrl: reader.result as string,
                width: videoWidth,
                height: videoHeight,
                duration: video.duration,
              });
            };
            reader.onerror = () => {
              reject(new Error('Failed to read thumbnail blob'));
            };
            reader.readAsDataURL(blob);
          },
          format,
          quality
        );
      } catch (error) {
        URL.revokeObjectURL(videoUrl);
        reject(error);
      }
    };
  });
}

/**
 * Generate thumbnail from video blob URL
 * @param blobUrl - Blob URL of the video
 * @param options - Thumbnail generation options
 * @returns Promise resolving to data URL of thumbnail
 */
export async function generateThumbnailFromBlobUrl(
  blobUrl: string,
  options: VideoThumbnailOptions = {}
): Promise<string> {
  const {
    captureTime = 1,
    maxWidth = 1280,
    maxHeight = 720,
    quality = 0.8,
    format = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = blobUrl;

    video.onerror = () => {
      reject(new Error('Failed to load video for thumbnail generation'));
    };

    video.onloadedmetadata = () => {
      const seekTime = Math.min(captureTime, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        let { videoWidth, videoHeight } = video;

        if (videoWidth > maxWidth || videoHeight > maxHeight) {
          const scale = Math.min(maxWidth / videoWidth, maxHeight / videoHeight);
          videoWidth = Math.floor(videoWidth * scale);
          videoHeight = Math.floor(videoHeight * scale);
        }

        canvas.width = videoWidth;
        canvas.height = videoHeight;
        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create thumbnail blob'));
              return;
            }

            const reader = new FileReader();
            reader.onload = () => {
              resolve(reader.result as string);
            };
            reader.onerror = () => {
              reject(new Error('Failed to read thumbnail blob'));
            };
            reader.readAsDataURL(blob);
          },
          format,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };
  });
}

/**
 * Validate if file is a video
 * @param file - File to validate
 * @returns Boolean indicating if file is a video
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/**
 * Get video metadata
 * @param videoFile - Video file
 * @returns Promise resolving to video metadata
 */
export async function getVideoMetadata(
  videoFile: File
): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Failed to load video metadata'));
    };

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(videoUrl);
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      });
    };
  });
}







