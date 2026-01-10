'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type CameraFacingMode = 'user' | 'environment';

export interface CameraState {
  stream: MediaStream | null;
  isActive: boolean;
  error: string | null;
  facingMode: CameraFacingMode;
  isMobile: boolean;
}

export type AspectRatio = '1:1' | '4:3' | '16:9' | 'free';

export interface CaptureOptions {
  aspectRatio?: AspectRatio;
  maxWidth?: number; // Max width in pixels (default: 1920)
  maxHeight?: number; // Max height in pixels (default: 1920)
  quality?: number; // JPEG quality 0-1 (default: 0.85)
}

export interface UseCameraReturn {
  state: CameraState;
  startCamera: (facingMode?: CameraFacingMode) => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
  capturePhoto: (options?: CaptureOptions) => Promise<Blob | null>;
  hasPermission: boolean | null;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}

/**
 * Camera hook - isolates all camera logic
 * Works on desktop and mobile (iOS Safari first-class)
 * Uses only navigator.mediaDevices.getUserMedia
 * 
 * Mobile behavior:
 * - Defaults to front camera (facingMode: "user")
 * - Supports switching between front/back cameras
 * 
 * Desktop behavior:
 * - Uses any available camera
 * - Falls back to file upload if no camera
 */
export function useCamera(): UseCameraReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null); // ✅ Rule 2: Ref to track current stream for async access
  const hasStartedCameraRef = useRef(false); // ✅ Dev-mode fix: Guard against duplicate camera start from Fast Refresh
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Store available camera devices for reliable switching
  const camerasRef = useRef<{ front?: string; back?: string }>({});
  const currentDeviceIdRef = useRef<string | null>(null);

  // Detect mobile vs desktop - use state to avoid hydration mismatch
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // Initialize mobile detection after mount (client-side only)
  useEffect(() => {
    const checkMobile = () => {
      const mobile = typeof window !== 'undefined' && (
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        (window.innerWidth <= 768 && 'ontouchstart' in window)
      );
      setIsMobile(mobile);
    };
    checkMobile();
    // Also check on resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Default facing mode: front camera on mobile, any on desktop
  const defaultFacingMode: CameraFacingMode = isMobile ? 'user' : 'user';
  
  /**
   * Enumerate available camera devices and identify front/back cameras
   * This provides more reliable camera switching on native smartphones
   */
  const enumerateCameras = useCallback(async (): Promise<void> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Reset camera device IDs
      camerasRef.current = {};
      
      for (const device of videoDevices) {
        const label = device.label.toLowerCase();
        // Identify front camera (user-facing)
        if (label.includes('front') || label.includes('user') || label.includes('facing')) {
          camerasRef.current.front = device.deviceId;
        }
        // Identify back camera (environment-facing)
        else if (label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('world')) {
          camerasRef.current.back = device.deviceId;
        }
      }
      
      // If we couldn't identify by label, try to infer from device count
      // On mobile devices, if we have 2+ cameras, first is usually front, second is back
      if (videoDevices.length >= 2 && !camerasRef.current.front && !camerasRef.current.back) {
        camerasRef.current.front = videoDevices[0].deviceId;
        camerasRef.current.back = videoDevices[1].deviceId;
      }
    } catch (err) {
      // Silently fail - we'll fall back to facingMode constraint
      console.warn('[useCamera] Failed to enumerate cameras:', err);
    }
  }, []);

  /**
   * Start camera stream
   * Only requests permission on user interaction (button click)
   * ✅ Dev-mode fix: Guard against duplicate starts from Fast Refresh / Strict Mode
   */
  const startCamera = useCallback(async (requestedFacingMode?: CameraFacingMode) => {
    // ✅ Dev-mode fix: Prevent duplicate camera start during Fast Refresh
    if (hasStartedCameraRef.current && stream) {
      console.warn('[useCamera] Camera already started, skipping duplicate start');
      return;
    }

    // Stop existing stream if any
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      streamRef.current = null; // ✅ Rule 2: Clear ref when stopping
      hasStartedCameraRef.current = false; // Reset guard when stopping
    }

    setError(null);
    hasStartedCameraRef.current = true; // Set guard before async operation

    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        hasStartedCameraRef.current = false; // Reset on error
        throw new Error('Camera not supported on this device');
      }

      const targetFacingMode = requestedFacingMode || defaultFacingMode;

      // Enumerate cameras on first start to identify front/back devices
      if (Object.keys(camerasRef.current).length === 0) {
        await enumerateCameras();
      }

      // Build video constraints - prefer deviceId for reliable switching, fallback to facingMode
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

      // If we have identified camera devices, use deviceId for more reliable switching
      if (targetFacingMode === 'user' && camerasRef.current.front) {
        videoConstraints.deviceId = { exact: camerasRef.current.front };
        currentDeviceIdRef.current = camerasRef.current.front;
      } else if (targetFacingMode === 'environment' && camerasRef.current.back) {
        videoConstraints.deviceId = { exact: camerasRef.current.back };
        currentDeviceIdRef.current = camerasRef.current.back;
      } else {
        // Fallback to facingMode constraint (works on most devices)
        videoConstraints.facingMode = targetFacingMode;
        currentDeviceIdRef.current = null;
      }

      // Request camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      setStream(mediaStream);
      streamRef.current = mediaStream; // ✅ Rule 2: Keep ref in sync with state
      setFacingMode(targetFacingMode);
      setHasPermission(true);
    } catch (err) {
      hasStartedCameraRef.current = false; // ✅ Reset guard on error
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
      setError(errorMessage);
      setHasPermission(false);
      
      // Handle specific permission errors
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera permission denied. Please allow camera access in your browser settings.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera found on this device.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera is already in use by another application.');
        }
      }
    }
  }, [stream, defaultFacingMode, enumerateCameras]);

  /**
   * Stop camera stream
   * ✅ Fix 2: This is the ONLY place that stops stream tracks
   * React cleanup effects must NEVER stop stream tracks
   */
  const stopCamera = useCallback(async () => {
    // ✅ Rule 2: ONLY stop preview stream tracks here - nowhere else
    // ✅ Rule 2: CLEAR stream state - critical to prevent reusing dead stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      streamRef.current = null; // ✅ Rule 2: Clear ref as well
      hasStartedCameraRef.current = false; // ✅ Reset guard when stopping camera
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setError(null);
  }, [stream]);

  /**
   * Switch between front and back cameras
   * Uses deviceId when available for reliable native smartphone camera switching
   * Falls back to facingMode constraint if devices aren't enumerated
   */
  const switchCamera = useCallback(async () => {
    if (!isMobile) {
      // Desktop doesn't typically have front/back cameras
      return;
    }

    // Determine which camera to switch to
    const newFacingMode: CameraFacingMode = facingMode === 'user' ? 'environment' : 'user';
    
    // If we have both cameras identified, switch directly
    if (camerasRef.current.front && camerasRef.current.back) {
      // Stop current stream first
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
        streamRef.current = null;
        hasStartedCameraRef.current = false;
      }
      
      // Small delay to ensure previous stream is fully stopped
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Start with new camera
      await startCamera(newFacingMode);
    } else {
      // Fallback: use facingMode constraint
      await startCamera(newFacingMode);
    }
  }, [facingMode, isMobile, startCamera, stream]);

  /**
   * Capture photo from video stream
   * Returns Blob for use in file uploads
   * Supports aspect ratio control, max dimensions, and quality settings
   */
  const capturePhoto = useCallback(async (options: CaptureOptions = {}): Promise<Blob | null> => {
    if (!stream || !videoRef.current) {
      return null;
    }

    try {
      const {
        aspectRatio = 'free',
        maxWidth = 1920,
        maxHeight = 1920,
        quality = 0.85,
      } = options;

      // Create canvas if it doesn't exist
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      const canvas = canvasRef.current;
      const video = videoRef.current;

      // Get video dimensions
      const videoWidth = video.videoWidth || 1280;
      const videoHeight = video.videoHeight || 720;
      const videoAspectRatio = videoWidth / videoHeight;

      // Calculate output dimensions based on aspect ratio
      let outputWidth = videoWidth;
      let outputHeight = videoHeight;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = videoWidth;
      let sourceHeight = videoHeight;

      if (aspectRatio !== 'free') {
        let targetAspectRatio: number;
        switch (aspectRatio) {
          case '1:1':
            targetAspectRatio = 1;
            break;
          case '4:3':
            targetAspectRatio = 4 / 3;
            break;
          case '16:9':
            targetAspectRatio = 16 / 9;
            break;
          default:
            targetAspectRatio = videoAspectRatio;
        }

        // Crop to match aspect ratio (center crop)
        if (videoAspectRatio > targetAspectRatio) {
          // Video is wider - crop width
          sourceHeight = videoHeight;
          sourceWidth = videoHeight * targetAspectRatio;
          sourceX = (videoWidth - sourceWidth) / 2;
          sourceY = 0;
        } else {
          // Video is taller - crop height
          sourceWidth = videoWidth;
          sourceHeight = videoWidth / targetAspectRatio;
          sourceX = 0;
          sourceY = (videoHeight - sourceHeight) / 2;
        }

        outputWidth = sourceWidth;
        outputHeight = sourceHeight;
      }

      // Apply max dimensions (maintain aspect ratio)
      if (outputWidth > maxWidth || outputHeight > maxHeight) {
        const scale = Math.min(maxWidth / outputWidth, maxHeight / outputHeight);
        outputWidth = Math.round(outputWidth * scale);
        outputHeight = Math.round(outputHeight * scale);
      }

      // Set canvas dimensions
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      // Draw video frame to canvas (with cropping if needed)
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Un-mirror front camera captures (to match un-mirrored preview)
      const isFrontCamera = facingMode === 'user';
      if (isFrontCamera) {
        // Save context state
        ctx.save();
        // Flip canvas horizontally for front camera
        ctx.translate(outputWidth, 0);
        ctx.scale(-1, 1);
      }

      // If aspect ratio was applied, draw cropped region
      if (aspectRatio !== 'free' && (sourceX !== 0 || sourceY !== 0 || sourceWidth !== videoWidth || sourceHeight !== videoHeight)) {
        ctx.drawImage(
          video,
          sourceX, sourceY, sourceWidth, sourceHeight, // Source rectangle
          0, 0, outputWidth, outputHeight // Destination rectangle
        );
      } else {
        // Draw full frame, scaled to output dimensions
        ctx.drawImage(video, 0, 0, outputWidth, outputHeight);
      }

      // Restore context state if we flipped it
      if (isFrontCamera) {
        ctx.restore();
      }

      // Convert canvas to Blob
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to capture photo'));
            }
          },
          'image/jpeg',
          quality
        );
      });
    } catch (err) {
      console.error('[useCamera] Error capturing photo:', err);
      return null;
    }
  }, [stream]);

  return {
    state: {
      stream,
      isActive: stream !== null,
      error,
      facingMode,
      isMobile,
    },
    startCamera,
    stopCamera,
    switchCamera,
    capturePhoto,
    hasPermission,
    // Expose refs for CameraView component
    videoRef: videoRef as React.MutableRefObject<HTMLVideoElement | null>,
    canvasRef: canvasRef as React.MutableRefObject<HTMLCanvasElement | null>,
  };
}

