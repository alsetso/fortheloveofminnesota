'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { CameraIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface MapScreenshotEditorProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
}

export default function MapScreenshotEditor({ map, mapLoaded }: MapScreenshotEditorProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [isScreenshotPreviewOpen, setIsScreenshotPreviewOpen] = useState(false);
  const [selectedCropSize, setSelectedCropSize] = useState<{ width: number; height: number } | null>(null);
  const [croppedScreenshot, setCroppedScreenshot] = useState<string | null>(null);
  const [textOverlay, setTextOverlay] = useState<{
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    align: 'left' | 'center' | 'right';
  } | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [finalScreenshot, setFinalScreenshot] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const screenshotContainerRef = useRef<HTMLDivElement>(null);

  // Handle mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Screenshot capture function with custom dimensions
  const captureMapScreenshot = useCallback(async (width?: number, height?: number): Promise<string | null> => {
    if (!map || !mapLoaded) {
      return null;
    }

    setIsCapturingScreenshot(true);

    try {
      const mapContainer = (map as any).getContainer() as HTMLElement;
      if (!mapContainer) {
        throw new Error('Map container not available');
      }

      // Store original dimensions
      const originalWidth = mapContainer.clientWidth;
      const originalHeight = mapContainer.clientHeight;
      const originalStyle = {
        width: mapContainer.style.width,
        height: mapContainer.style.height,
      };

      // If custom dimensions provided, temporarily resize
      if (width && height) {
        mapContainer.style.width = `${width}px`;
        mapContainer.style.height = `${height}px`;
        (map as any).resize();
      }

      // Wait for map to finish rendering
      await new Promise<void>((resolve) => {
        if ((map as any).loaded()) {
          resolve();
        } else {
          (map as any).once('idle', () => resolve());
        }
      });

      // Small delay to ensure everything is rendered
      await new Promise<void>((resolve) => setTimeout(resolve, 200));

      const canvas = (map as any).getCanvas() as HTMLCanvasElement;
      if (!canvas) {
        throw new Error('Canvas not available');
      }

      // Check if canvas is valid
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas has invalid dimensions');
      }

      // If custom dimensions, create a resized canvas
      let finalCanvas = canvas;
      if (width && height) {
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = width;
        resizedCanvas.height = height;
        const ctx = resizedCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, 0, width, height);
          finalCanvas = resizedCanvas;
        }
      }

      // Composite pin popups onto the canvas
      const ctx = finalCanvas.getContext('2d');
      if (ctx && mapContainer) {
        // Find all Mapbox popups - search in document body as they might be rendered there
        const allPopups = document.querySelectorAll('.mapboxgl-popup');
        const containerRect = mapContainer.getBoundingClientRect();
        
        console.log(`[Screenshot] Found ${allPopups.length} popups in document`);
        
        for (const popup of Array.from(allPopups)) {
          const popupElement = popup as HTMLElement;
          if (!popupElement || popupElement.offsetParent === null) {
            console.log('[Screenshot] Skipping hidden popup');
            continue; // Skip hidden popups
          }
          
          try {
            // Get popup position relative to viewport
            const rect = popupElement.getBoundingClientRect();
            
            // Check if popup is within map container bounds
            const isInContainer = 
              rect.left < containerRect.right &&
              rect.right > containerRect.left &&
              rect.top < containerRect.bottom &&
              rect.bottom > containerRect.top;
            
            if (!isInContainer) {
              console.log('[Screenshot] Popup outside map container bounds');
              continue;
            }
            
            // Calculate position relative to canvas
            const scaleX = finalCanvas.width / mapContainer.clientWidth;
            const scaleY = finalCanvas.height / mapContainer.clientHeight;
            
            const x = (rect.left - containerRect.left) * scaleX;
            const y = (rect.top - containerRect.top) * scaleY;
            const popupWidth = Math.ceil(rect.width * scaleX);
            const popupHeight = Math.ceil(rect.height * scaleY);
            
            console.log(`[Screenshot] Capturing popup at (${x}, ${y}) size ${popupWidth}x${popupHeight}`);
            
            // Capture popup using html2canvas
            try {
              const popupCanvas = await html2canvas(popupElement, {
                backgroundColor: null,
                scale: 1,
                width: popupWidth,
                height: popupHeight,
                useCORS: true,
                logging: false,
                allowTaint: true,
                windowWidth: popupWidth,
                windowHeight: popupHeight,
              });
              
              ctx.drawImage(popupCanvas, x, y, popupWidth, popupHeight);
              console.log('[Screenshot] Popup captured successfully');
            } catch (error) {
              // Fallback: Draw a simple representation of the popup if html2canvas fails
              console.warn('Could not capture popup with html2canvas, using fallback:', error);
              
              // Draw background
              ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
              ctx.fillRect(x, y, popupWidth, popupHeight);
              
              // Draw border
              ctx.strokeStyle = '#e5e7eb';
              ctx.lineWidth = 1;
              ctx.strokeRect(x, y, popupWidth, popupHeight);
              
              // Draw text placeholder
              ctx.fillStyle = '#111827';
              ctx.font = '12px sans-serif';
              ctx.fillText('Pin Popup', x + 8, y + 20);
            }
          } catch (error) {
            // Skip this popup if there's an error
            console.warn('Could not capture popup in screenshot:', error);
          }
        }
      }

      const dataUrl = finalCanvas.toDataURL('image/png', 0.9);
      
      // Restore original dimensions if they were changed
      if (width && height) {
        mapContainer.style.width = originalStyle.width;
        mapContainer.style.height = originalStyle.height;
        (map as any).resize();
      }
      
      // Validate data URL
      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Invalid screenshot data');
      }
      
      setIsCapturingScreenshot(false);
      return dataUrl;
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      setIsCapturingScreenshot(false);
      
      // Restore original dimensions on error
      try {
        const mapContainer = (map as any).getContainer() as HTMLElement;
        if (mapContainer && width && height) {
          mapContainer.style.width = '';
          mapContainer.style.height = '';
          (map as any).resize();
        }
      } catch (restoreError) {
        console.error('Error restoring map dimensions:', restoreError);
      }
      
      return null;
    }
  }, [map, mapLoaded]);

  // Handle screenshot button click - capture and show modal
  const handleScreenshotClick = useCallback(async () => {
    const screenshotData = await captureMapScreenshot();
    if (screenshotData) {
      setScreenshot(screenshotData);
      setCroppedScreenshot(null);
      setSelectedCropSize(null);
      setTextOverlay(null);
      setFinalScreenshot(null);
      setIsScreenshotPreviewOpen(true);
    }
  }, [captureMapScreenshot]);

  // Crop screenshot to selected size
  const cropScreenshot = useCallback((width: number, height: number) => {
    if (!screenshot) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;

      // Calculate aspect ratios
      const imgAspect = img.width / img.height;
      const cropAspect = width / height;

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = img.width;
      let sourceHeight = img.height;

      // Crop to match aspect ratio
      if (imgAspect > cropAspect) {
        // Image is wider - crop width
        sourceWidth = img.height * cropAspect;
        sourceX = (img.width - sourceWidth) / 2;
      } else {
        // Image is taller - crop height
        sourceHeight = img.width / cropAspect;
        sourceY = (img.height - sourceHeight) / 2;
      }

      // Draw cropped image
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        width,
        height
      );

      const croppedDataUrl = canvas.toDataURL('image/png', 0.9);
      setCroppedScreenshot(croppedDataUrl);
      setSelectedCropSize({ width, height });
      setFinalScreenshot(null); // Reset final screenshot when cropping
    };
    img.src = screenshot;
  }, [screenshot]);

  // Draw text overlay on canvas
  const drawTextOverlay = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!textOverlay || !textOverlay.text.trim()) return;

    ctx.save();
    ctx.font = `${textOverlay.fontSize}px sans-serif`;
    ctx.fillStyle = textOverlay.color;
    ctx.textAlign = textOverlay.align;
    ctx.textBaseline = 'top';

    // Calculate text position based on percentage
    let x = (textOverlay.x / 100) * width;
    const y = (textOverlay.y / 100) * height;

    // Adjust x based on alignment
    if (textOverlay.align === 'center') {
      x = width / 2;
    } else if (textOverlay.align === 'right') {
      x = width - ((100 - textOverlay.x) / 100) * width;
    }

    // Draw text with shadow for readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillText(textOverlay.text, x, y);
    ctx.restore();
  }, [textOverlay]);

  // Capture final screenshot with text overlay
  const captureFinalScreenshot = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const imageToUse = croppedScreenshot || screenshot;
      if (!imageToUse) {
        resolve(null);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const finalWidth = selectedCropSize?.width || img.width;
        const finalHeight = selectedCropSize?.height || img.height;
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(null);
          return;
        }

        // Draw the base image
        if (selectedCropSize && croppedScreenshot) {
          // If cropped, use cropped screenshot
          const croppedImg = new Image();
          croppedImg.onload = () => {
            ctx.drawImage(croppedImg, 0, 0, finalWidth, finalHeight);
            drawTextOverlay(ctx, finalWidth, finalHeight);
            const finalDataUrl = canvas.toDataURL('image/png', 0.9);
            setFinalScreenshot(finalDataUrl);
            resolve(finalDataUrl);
          };
          croppedImg.onerror = () => resolve(null);
          croppedImg.src = croppedScreenshot;
        } else {
          // Scale image to fit canvas
          const scale = Math.min(finalWidth / img.width, finalHeight / img.height);
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const x = (finalWidth - scaledWidth) / 2;
          const y = (finalHeight - scaledHeight) / 2;
          
          ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
          drawTextOverlay(ctx, finalWidth, finalHeight);
          const finalDataUrl = canvas.toDataURL('image/png', 0.9);
          setFinalScreenshot(finalDataUrl);
          resolve(finalDataUrl);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageToUse;
    });
  }, [croppedScreenshot, screenshot, selectedCropSize, textOverlay, drawTextOverlay]);

  // Auto-update final screenshot when text overlay changes (debounced)
  useEffect(() => {
    if (!textOverlay || !textOverlay.text.trim()) {
      setFinalScreenshot(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      captureFinalScreenshot();
    }, 500); // Debounce by 500ms

    return () => clearTimeout(timeoutId);
  }, [textOverlay, captureFinalScreenshot]);

  const handleClose = useCallback(() => {
    setIsScreenshotPreviewOpen(false);
    setScreenshot(null);
    setCroppedScreenshot(null);
    setSelectedCropSize(null);
    setTextOverlay(null);
    setFinalScreenshot(null);
    setIsEditingText(false);
  }, []);

  // Modal content
  const modalContent = isScreenshotPreviewOpen && screenshot && mounted ? (
    <div className="fixed inset-0 z-[1002] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Map Screenshot</h3>
              <button
                onClick={handleClose}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Crop Size Selection */}
            <div className="px-3 py-2 border-b border-gray-200">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-700">Crop Size:</span>
                <button
                  onClick={() => cropScreenshot(1920, 1080)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    selectedCropSize?.width === 1920 && selectedCropSize?.height === 1080
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  1920 × 1080
                </button>
                <button
                  onClick={() => cropScreenshot(1080, 1080)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    selectedCropSize?.width === 1080 && selectedCropSize?.height === 1080
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  1080 × 1080
                </button>
                <button
                  onClick={() => cropScreenshot(1080, 1920)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    selectedCropSize?.width === 1080 && selectedCropSize?.height === 1920
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  1080 × 1920
                </button>
                {selectedCropSize && (
                  <button
                    onClick={() => {
                      setCroppedScreenshot(null);
                      setSelectedCropSize(null);
                      setFinalScreenshot(null);
                    }}
                    className="ml-auto px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Text Overlay Controls */}
            <div className="px-3 py-2 border-b border-gray-200 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!textOverlay) {
                      setTextOverlay({
                        text: 'Add your text here',
                        x: 50,
                        y: 20,
                        fontSize: 32,
                        color: '#ffffff',
                        align: 'center',
                      });
                      setIsEditingText(true);
                    } else {
                      setIsEditingText(!isEditingText);
                    }
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    textOverlay ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {textOverlay ? 'Edit Text' : 'Add Text'}
                </button>
                {textOverlay && (
                  <button
                    onClick={() => {
                      setTextOverlay(null);
                      setFinalScreenshot(null);
                    }}
                    className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Remove Text
                  </button>
                )}
              </div>
              {isEditingText && textOverlay && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <input
                    type="text"
                    value={textOverlay.text}
                    onChange={(e) => setTextOverlay({ ...textOverlay, text: e.target.value })}
                    placeholder="Enter text"
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Size:</label>
                    <input
                      type="range"
                      min="16"
                      max="72"
                      value={textOverlay.fontSize}
                      onChange={(e) => setTextOverlay({ ...textOverlay, fontSize: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-600 w-8">{textOverlay.fontSize}px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Color:</label>
                    <input
                      type="color"
                      value={textOverlay.color}
                      onChange={(e) => setTextOverlay({ ...textOverlay, color: e.target.value })}
                      className="w-8 h-8 rounded border border-gray-300"
                    />
                    <select
                      value={textOverlay.align}
                      onChange={(e) => setTextOverlay({ ...textOverlay, align: e.target.value as 'left' | 'center' | 'right' })}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Position:</label>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500 w-12">X:</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={textOverlay.x}
                          onChange={(e) => setTextOverlay({ ...textOverlay, x: parseInt(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="text-xs text-gray-600 w-8">{textOverlay.x}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500 w-12">Y:</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={textOverlay.y}
                          onChange={(e) => setTextOverlay({ ...textOverlay, y: parseInt(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="text-xs text-gray-600 w-8">{textOverlay.y}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Screenshot Image */}
            <div ref={screenshotContainerRef} className="relative bg-gray-100 overflow-auto flex-1 flex items-center justify-center p-6">
              <div className="relative bg-white rounded-md p-4 shadow-sm border border-gray-200 max-w-full max-h-full">
                <img
                  src={finalScreenshot || croppedScreenshot || screenshot}
                  alt="Map screenshot"
                  className="max-w-full max-h-full"
                  style={{
                    objectFit: 'contain',
                    maxWidth: '600px',
                    maxHeight: '400px',
                  }}
                />
                {/* Text Overlay Preview - Only show if not using final screenshot */}
                {!finalScreenshot && textOverlay && textOverlay.text.trim() && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${textOverlay.x}%`,
                      top: `${textOverlay.y}%`,
                      transform: `translate(${textOverlay.align === 'center' ? '-50%' : textOverlay.align === 'right' ? '-100%' : '0'}, 0)`,
                      fontSize: `${textOverlay.fontSize}px`,
                      color: textOverlay.color,
                      textAlign: textOverlay.align,
                      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
                      maxWidth: '90%',
                    }}
                  >
                    {textOverlay.text}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between gap-2 p-3 border-t border-gray-200">
              <button
                onClick={handleClose}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const imageToDownload = finalScreenshot || croppedScreenshot || screenshot;
                  if (imageToDownload) {
                    const link = document.createElement('a');
                    const sizeSuffix = selectedCropSize 
                      ? `-${selectedCropSize.width}x${selectedCropSize.height}`
                      : '';
                    const textSuffix = textOverlay ? '-with-text' : '';
                    link.download = `map-screenshot${sizeSuffix}${textSuffix}-${new Date().toISOString().split('T')[0]}.png`;
                    link.href = imageToDownload;
                    link.click();
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors"
              >
                Download
              </button>
            </div>
          </div>
        </div>
  ) : null;

  return (
    <>
      {/* Screenshot Icon */}
      <div className="border-l border-gray-200">
        <button
          className={`flex items-center justify-center w-11 h-11 text-gray-700 hover:bg-gray-50 transition-all duration-150 pointer-events-auto ${
            isCapturingScreenshot ? 'bg-gray-100' : ''
          }`}
          title="Screenshot"
          aria-label="Capture Screenshot"
          onClick={(e) => {
            e.stopPropagation();
            handleScreenshotClick();
          }}
          disabled={isCapturingScreenshot || !mapLoaded}
        >
          {isCapturingScreenshot ? (
            <ArrowPathIcon className="w-5 h-5 animate-spin" />
          ) : (
            <CameraIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Screenshot Preview Modal - Rendered via portal */}
      {mounted && modalContent && createPortal(modalContent, document.body)}
    </>
  );
}
