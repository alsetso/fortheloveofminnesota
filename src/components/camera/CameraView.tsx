'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { CameraIcon, ArrowPathIcon, XMarkIcon, PhotoIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
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
  const textInputRef = useRef<HTMLInputElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showCaptureFeedback, setShowCaptureFeedback] = useState(false);
  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(null);
  const [capturedImagePreview, setCapturedImagePreview] = useState<string | null>(null);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [textOverlay, setTextOverlay] = useState<string>('');
  const [textPosition, setTextPosition] = useState({ x: 50, y: 50 }); // Percentage positions
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('large');
  const [isDraggingText, setIsDraggingText] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [isEditingText, setIsEditingText] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const mouseDownRef = useRef(false);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  // Always use free aspect ratio (no cropping)
  const aspectRatio: AspectRatio = 'free';

  // ✅ Rule: Only assign and play the video ONCE per stream
  // Guard against Fast Refresh / re-render interruptions
  // Also re-initialize when returning from preview (when capturedImagePreview is cleared)
  useEffect(() => {
    const video = camera.videoRef.current;
    if (!video || !camera.state.stream) return;

    // Reassign stream when returning from preview or if stream changed
    if (video.srcObject !== camera.state.stream) {
      video.srcObject = camera.state.stream;
    }

    // Always ensure video is playing when stream is active and not showing preview
    if (!capturedImagePreview && video.paused) {
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
  }, [camera.state.stream, camera.videoRef, capturedImagePreview]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (capturedImagePreview) {
        URL.revokeObjectURL(capturedImagePreview);
      }
    };
  }, [capturedImagePreview]);

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
      setIsCapturing(false);
      // Create preview URL
      const previewUrl = URL.createObjectURL(blob);
      setCapturedImageBlob(blob);
      setCapturedImagePreview(previewUrl);
    } else {
      setIsCapturing(false);
    }
  };

  const handleNext = async () => {
    if (capturedImageBlob) {
      let finalBlob = capturedImageBlob;
      
      // If text overlay exists, render it on the image
      if (textOverlay.trim()) {
        finalBlob = await renderTextOnImage(capturedImageBlob, textOverlay, textPosition, textSize);
      }
      
      // Clean up preview URL
      if (capturedImagePreview) {
        URL.revokeObjectURL(capturedImagePreview);
      }
      onCapture(finalBlob);
    }
  };

  const renderTextOnImage = async (imageBlob: Blob, text: string, position: { x: number; y: number }, size: 'small' | 'medium' | 'large'): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(imageBlob);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw image
        ctx.drawImage(img, 0, 0);
        
        // Calculate font size based on image dimensions and selected size
        const baseSize = Math.min(canvas.width, canvas.height);
        let fontSize: number;
        let lineWidth: number;
        
        switch (size) {
          case 'small':
            fontSize = baseSize * 0.04; // 4% of smaller dimension
            lineWidth = 2;
            break;
          case 'large':
            fontSize = Math.min(80, baseSize * 0.15); // Max 80px or 15% of smaller dimension
            lineWidth = 6;
            break;
          default: // medium
            fontSize = baseSize * 0.06; // 6% of smaller dimension
            lineWidth = 4;
        }
        
        // Draw text overlay
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = lineWidth;
        ctx.font = `bold ${Math.round(fontSize)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const x = (position.x / 100) * canvas.width;
        const y = (position.y / 100) * canvas.height;
        
        // Draw text with outline (stroke then fill)
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
        
        // Convert to blob
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/jpeg', 0.9);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  };

  const handleTextMouseDown = (e: React.MouseEvent) => {
    // Prevent dragging if editing
    if (isEditingText || showTextEditor) {
      textInputRef.current?.focus();
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    mouseDownRef.current = true;
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    
    const img = imageContainerRef.current?.querySelector('img');
    if (!img) return;
    
    const rect = img.getBoundingClientRect();
    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Store offset from click position to text position
    dragOffsetRef.current = { 
      x: startX - textPosition.x, 
      y: startY - textPosition.y 
    };
  };

  const handleTextDrag = useCallback((e: MouseEvent) => {
    if (!mouseDownRef.current || isEditingText || showTextEditor) return;
    
    // Only start dragging if mouse has moved significantly (to distinguish from click)
    const moveThreshold = 5;
    const deltaX = Math.abs(e.clientX - mouseDownPosRef.current.x);
    const deltaY = Math.abs(e.clientY - mouseDownPosRef.current.y);
    
    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      if (!isDraggingText) {
        setIsDraggingText(true);
      }
      
      const img = imageContainerRef.current?.querySelector('img');
      if (!img) return;
      
      const rect = img.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      setTextPosition({ 
        x: Math.max(5, Math.min(95, x - dragOffsetRef.current.x)), 
        y: Math.max(5, Math.min(95, y - dragOffsetRef.current.y)) 
      });
    }
  }, [isDraggingText, isEditingText, showTextEditor]);

  const handleTextDragEnd = useCallback(() => {
    mouseDownRef.current = false;
    setIsDraggingText(false);
  }, []);

  // Handle global mouse events for dragging
  // Add listeners when mouse is down or dragging is active
  useEffect(() => {
    // Only add listeners if text exists and we're not editing
    const hasText = textOverlay.trim();
    const canDrag = hasText && !showTextEditor && !isEditingText;
    
    if (canDrag) {
      const handleMouseMove = (e: MouseEvent) => {
        if (mouseDownRef.current) {
          handleTextDrag(e);
        }
      };
      
      const handleMouseUp = () => {
        if (mouseDownRef.current) {
          handleTextDragEnd();
        }
      };
      
      // Always have listeners ready when text is visible and not editing
      // They'll only act if mouseDownRef.current is true
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    
    return undefined;
  }, [textOverlay, showTextEditor, isEditingText, handleTextDrag, handleTextDragEnd]);

  // Auto-focus text input when editor opens
  useEffect(() => {
    if (showTextEditor && textInputRef.current) {
      // Small delay to ensure modal is rendered
      const timeoutId = setTimeout(() => {
        textInputRef.current?.focus();
        // Center cursor in input if text exists
        if (textInputRef.current && textOverlay) {
          const length = textOverlay.length;
          textInputRef.current.setSelectionRange(length, length);
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
    
    return undefined;
  }, [showTextEditor, textOverlay]);

  // Reset text editor state when closing
  const handleCloseTextEditor = useCallback(() => {
    setShowTextEditor(false);
    setIsEditingText(false);
    // If no text, clear it completely
    if (!textOverlay.trim()) {
      setTextOverlay('');
      setTextPosition({ x: 50, y: 50 });
    }
  }, [textOverlay]);

  // Handle text clear with focus management
  const handleClearText = useCallback(() => {
    setTextOverlay('');
    // Refocus input after clearing
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 0);
  }, []);

  // Handle double-clicking on rendered text to refocus input for editing
  const handleTextOverlayDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If text exists, just refocus the input to edit
    if (textOverlay.trim()) {
      setIsEditingText(true);
      setShowTextEditor(true);
      setTimeout(() => {
        textInputRef.current?.focus();
        if (textInputRef.current) {
          const length = textOverlay.length;
          textInputRef.current.setSelectionRange(length, length);
        }
      }, 50);
    } else {
      // If no text, open editor
      setIsEditingText(true);
      setShowTextEditor(true);
      setTextPosition({ x: 50, y: 50 });
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 50);
    }
  }, [textOverlay]);

  // Handle input blur - clear text if empty
  const handleInputBlur = useCallback(() => {
    setIsEditingText(false);
    if (!textOverlay.trim()) {
      setShowTextEditor(false);
      setTextOverlay('');
      setTextPosition({ x: 50, y: 50 });
    }
  }, [textOverlay]);

  const handleRetake = () => {
    // Clean up preview URL
    if (capturedImagePreview) {
      URL.revokeObjectURL(capturedImagePreview);
    }
    setCapturedImageBlob(null);
    setCapturedImagePreview(null);
    setIsCapturing(false);
    setShowCaptureFeedback(false);
    setShowTextEditor(false);
    setIsEditingText(false);
    setTextOverlay('');
    setTextPosition({ x: 50, y: 50 });
    setTextSize('large');
    setIsDraggingText(false);
    
    // Force video to re-initialize by reassigning stream and playing
    // Use setTimeout to ensure state update completes first
    setTimeout(() => {
      if (camera.state.isActive && camera.state.stream && camera.videoRef.current) {
        const video = camera.videoRef.current;
        // Reassign stream to ensure it's connected
        if (video.srcObject !== camera.state.stream) {
          video.srcObject = camera.state.stream;
        }
        // Ensure video is playing
        if (video.paused) {
          video.play().catch(err => {
            if (err.name !== 'AbortError') {
              console.error('[Camera] Error resuming video after retake:', err);
            }
          });
        }
      }
    }, 0);
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

  // Show preview if image was captured
  if (capturedImagePreview && capturedImageBlob) {
    return (
      <div 
        className={`fixed inset-0 z-[70] ${className}`} 
        style={{ backgroundColor: 'black' }}
      >
        {/* Redo Button - Top Left */}
        <div className="absolute top-4 left-4 z-20 pointer-events-auto">
          <button
            onClick={handleRetake}
            className="p-2 text-white hover:text-white/80 transition-colors"
            aria-label="Redo photo"
          >
            <ArrowPathIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Captured Image Preview */}
        <div ref={imageContainerRef} className="relative w-full h-full">
          <img
            src={capturedImagePreview}
            alt="Captured photo"
            className="w-full h-full object-contain"
          />
          
          {/* Text Overlay - Show when text exists (hidden when editing, input is visible instead) */}
          {textOverlay.trim() && !showTextEditor && (
            <div
              style={{
                position: 'absolute',
                left: `${textPosition.x}%`,
                top: `${textPosition.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className={`pointer-events-auto ${
                isDraggingText 
                  ? 'cursor-grabbing select-none' 
                  : 'cursor-grab select-none'
              }`}
              onMouseDown={handleTextMouseDown}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                mouseDownRef.current = false; // Cancel any drag
                handleTextOverlayDoubleClick(e);
              }}
            >
              <div className="px-6 py-3 bg-transparent rounded-md">
                <span 
                  className={`font-bold text-white whitespace-nowrap drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)] ${
                    textSize === 'small' ? 'text-xl' : 
                    textSize === 'large' ? 'text-7xl' : 
                    'text-3xl'
                  }`}
                  style={{
                    textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.5)',
                  }}
                >
                  {textOverlay}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Text Editor Input - Visible when editing */}
        {showTextEditor && (
          <div className="absolute inset-0 bg-transparent z-20 pointer-events-auto">
            <input
              ref={textInputRef}
              type="text"
              value={textOverlay}
              onChange={(e) => setTextOverlay(e.target.value)}
              placeholder=""
              className={`absolute bg-transparent border-none outline-none text-center ${
                textSize === 'small' ? 'text-xl' : 
                textSize === 'large' ? 'text-7xl' : 
                'text-3xl'
              } font-bold text-white`}
              style={{
                left: `${textPosition.x}%`,
                top: `${textPosition.y}%`,
                transform: 'translate(-50%, -50%)',
                textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.5)',
                minWidth: '200px',
                maxWidth: '90%',
              }}
              maxLength={50}
              onKeyDown={(e) => {
                // Close editor on Escape
                if (e.key === 'Escape') {
                  handleCloseTextEditor();
                }
                // Close editor on Enter if text exists
                if (e.key === 'Enter' && textOverlay.trim()) {
                  handleCloseTextEditor();
                }
              }}
              onFocus={() => setIsEditingText(true)}
              onBlur={() => {
                setIsEditingText(false);
                handleInputBlur();
              }}
            />
          </div>
        )}

        {/* Controls Overlay */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pb-safe pointer-events-auto">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-between gap-2 w-full">
                {/* Add Text / Remove Text Button - Bottom Left */}
                {!textOverlay.trim() ? (
                  <button
                    onClick={() => {
                      setTextPosition({ x: 50, y: 50 }); // Center text when opening editor
                      setIsEditingText(true);
                      setShowTextEditor(true);
                    }}
                    className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-md text-sm font-medium hover:bg-white/30 transition-colors"
                    aria-label="Add text"
                  >
                    Add Text
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setTextOverlay('');
                      setShowTextEditor(false);
                      setIsEditingText(false);
                    }}
                    className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-md text-sm font-medium hover:bg-white/30 transition-colors"
                    aria-label="Remove text"
                  >
                    Remove Text
                  </button>
                )}

                {/* Next Button - Bottom Right */}
                <button
                  onClick={handleNext}
                  className="px-4 py-2 bg-white text-gray-900 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
                  aria-label="Next"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-[70] ${className}`} style={{ backgroundColor: 'transparent' }}>
      {/* ✅ Fix F: Video element with explicit z-index, no black background */}
      {/* Un-mirror front camera preview (user-facing cameras are naturally mirrored) */}
      <video
        ref={camera.videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover absolute inset-0 z-0"
        style={{ 
          pointerEvents: 'none',
          transform: camera.state.facingMode === 'user' ? 'scaleX(-1)' : 'none'
        }}
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



      {/* Close Button - Top Right */}
      {camera.state.isActive && (
        <div className="absolute top-4 right-4 z-10 pointer-events-auto">
          <button
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            aria-label="Close camera"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* ✅ Fix F: Controls Overlay - explicit z-index, only gradient area dark */}
      {camera.state.isActive && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pb-safe pointer-events-auto">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center gap-4">
                {/* Photo Capture Button */}
                <button
                  onClick={handleCapture}
                  disabled={isCapturing}
                  className="w-16 h-16 rounded-full bg-transparent backdrop-blur-sm border-[6px] border-white flex items-center justify-center hover:bg-white hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Capture photo"
                >
                  {isCapturing ? (
                    <div className="w-12 h-12 rounded-full bg-gray-300 animate-pulse" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-transparent" />
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
