'use client';

import { useEffect, useRef, useState } from 'react';
import { CameraIcon, ArrowPathIcon, XMarkIcon, PhotoIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { UseCameraReturn, AspectRatio, CaptureOptions } from '@/hooks/useCamera';

interface CameraViewProps {
  camera: UseCameraReturn;
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  className?: string;
}

/**
 * CameraView component - handles rendering only
 * Decoupled from camera logic (handled by useCamera hook)
 * 
 * Rules:
 * 1. Video element never conditionally rendered - created once with ref
 * 2. Video element has pointer-events: none
 * 3. Photo capture only
 */
export default function CameraView({
  camera,
  onCapture,
  onClose,
  className = '',
}: CameraViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showCaptureFeedback, setShowCaptureFeedback] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('free'); // Default to free (use video dimensions)

  // ✅ Rule: Only assign and play the video ONCE per stream
  // Guard against Fast Refresh / re-render interruptions
  useEffect(() => {
    const video = camera.videoRef.current;
    if (!video || !camera.state.stream) return;

    // Only assign once - prevent reassignment during Fast Refresh
    if (video.srcObject !== camera.state.stream) {
      video.srcObject = camera.state.stream;
    }

    // Only call play if needed - handle AbortError gracefully (expected in dev mode)
    if (video.paused) {
      video
        .play()
        .catch(err => {
          // ✅ AbortError is harmless and expected during Fast Refresh
          // Do NOT treat it as a failure
          if (err.name !== 'AbortError') {
            console.error('[Camera] play error:', err);
          }
        });
    }
  }, [camera.state.stream, camera.videoRef]);

  const handleCapture = async () => {
    setIsCapturing(true);
    const options: CaptureOptions = {
      aspectRatio,
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.85,
    };
    const blob = await camera.capturePhoto(options);
    if (blob) {
      setShowCaptureFeedback(true);
      setTimeout(() => {
        setShowCaptureFeedback(false);
        setIsCapturing(false);
        onCapture(blob);
      }, 500);
    } else {
      setIsCapturing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          const blob = new Blob([reader.result as ArrayBuffer], { type: file.type });
          onCapture(blob);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className={`fixed inset-0 z-[70] ${className}`} style={{ backgroundColor: 'transparent' }}>
      {/* ✅ Fix F: Video element with explicit z-index, no black background */}
      <video
        ref={camera.videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover absolute inset-0 z-0"
        style={{ pointerEvents: 'none' }}
      />

      {/* Capture Feedback Overlay - positioned to not block video */}
      {showCaptureFeedback && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[70] bg-white/95 backdrop-blur-sm px-6 py-4 rounded-lg shadow-lg pointer-events-auto">
          <div className="flex flex-col items-center gap-2">
            <CheckCircleIcon className="w-12 h-12 text-green-500" />
            <p className="text-sm font-semibold text-gray-900">Photo captured</p>
          </div>
        </div>
      )}


      {/* Aspect Ratio Crop Guide Overlay */}
      {camera.state.isActive && aspectRatio !== 'free' && (
        <div className="absolute inset-0 pointer-events-none z-5">
          <div className="absolute inset-0 flex items-center justify-center">
            {(() => {
              const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
              const containerHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
              let guideWidth = containerWidth * 0.9;
              let guideHeight: number;
              
              switch (aspectRatio) {
                case '1:1':
                  guideHeight = guideWidth;
                  break;
                case '4:3':
                  guideHeight = guideWidth * (3 / 4);
                  break;
                case '16:9':
                  guideHeight = guideWidth * (9 / 16);
                  break;
                default:
                  guideHeight = guideWidth;
              }
              
              if (guideHeight > containerHeight * 0.9) {
                guideHeight = containerHeight * 0.9;
                guideWidth = aspectRatio === '1:1' ? guideHeight : 
                            aspectRatio === '4:3' ? guideHeight * (4 / 3) :
                            guideHeight * (16 / 9);
              }
              
              return (
                <div
                  className="border-2 border-white/80 border-dashed rounded-lg"
                  style={{
                    width: `${guideWidth}px`,
                    height: `${guideHeight}px`,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)',
                  }}
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* ✅ Fix F: Controls Overlay - explicit z-index, only gradient area dark */}
      {camera.state.isActive && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pb-safe pointer-events-auto">
            <div className="flex flex-col items-center gap-2">
              {/* Aspect Ratio Selector */}
              <div className="flex items-center gap-2 mb-2">
                {(['1:1', '4:3', '16:9', 'free'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      aspectRatio === ratio
                        ? 'bg-white text-black'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    aria-label={`Aspect ratio ${ratio}`}
                  >
                    {ratio === 'free' ? 'Free' : ratio}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-center gap-4">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                  aria-label="Close camera"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>

                {/* Photo Capture Button */}
                <button
                  onClick={handleCapture}
                  disabled={isCapturing}
                  className="w-16 h-16 rounded-full bg-white border-4 border-white/30 flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Capture photo"
                >
                  {isCapturing ? (
                    <div className="w-12 h-12 rounded-full bg-gray-300 animate-pulse" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white" />
                  )}
                </button>

                {/* Switch Camera Button (mobile only) */}
                {camera.state.isMobile && (
                  <button
                    onClick={camera.switchCamera}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                    aria-label="Switch camera"
                  >
                    <ArrowPathIcon className="w-6 h-6" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Media Upload Button - Bottom Right */}
          <div className="absolute bottom-4 right-4 z-10 pointer-events-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              aria-label="Upload image"
            >
              <PhotoIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {camera.state.error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-white pointer-events-auto">
          <CameraIcon className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-center mb-4">{camera.state.error}</p>

          {/* File Upload Fallback (Desktop) */}
          {!camera.state.isMobile && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white text-black rounded-md hover:bg-gray-100 transition-colors"
              >
                Upload Image Instead
              </button>
            </>
          )}

          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 text-white/80 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* Loading/Initial State */}
      {!camera.state.isActive && !camera.state.error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-auto">
          <CameraIcon className="w-16 h-16 mb-4 opacity-50 animate-pulse" />
          <p className="text-center">Starting camera...</p>
        </div>
      )}
    </div>
  );
}
