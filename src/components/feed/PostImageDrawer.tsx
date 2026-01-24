'use client';

import { useState, useRef, useCallback, DragEvent } from 'react';

interface PostImageDrawerProps {
  onClose: () => void;
  onImagesSave: (images: Array<{ url: string; alt?: string; type: 'image' | 'video' }>) => void;
  initialImages?: Array<{ url: string; alt?: string; type?: 'image' | 'video' }>;
  canUploadVideo?: boolean;
}

export default function PostImageDrawer({ 
  onClose, 
  onImagesSave, 
  initialImages = [],
  canUploadVideo = false 
}: PostImageDrawerProps) {
  const [images, setImages] = useState<Array<{ url: string; alt?: string; type?: 'image' | 'video' }>>(initialImages.map(img => ({ ...img, type: img.type || 'image' as const })));
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    const validFiles = Array.from(files).filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        setError(`File type not supported: ${file.name}`);
        return false;
      }
      
      if (isVideo && !canUploadVideo) {
        setError('Video uploads are only available for Contributor, Professional, and Business plans.');
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) return;

    let processedCount = 0;
    const newImages: Array<{ url: string; alt?: string; type: 'image' | 'video' }> = [];

    validFiles.forEach((file) => {
      const isImage = file.type.startsWith('image/');
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const url = event.target?.result as string;
        newImages.push({
          url,
          alt: file.name,
          type: isImage ? 'image' : 'video'
        });
        
        processedCount++;
        
        // Update state when all files are processed
        if (processedCount === validFiles.length) {
          setImages((prev) => [...prev, ...newImages]);
        }
      };
      
      reader.onerror = () => {
        setError(`Failed to read file: ${file.name}`);
        processedCount++;
        if (processedCount === validFiles.length && newImages.length > 0) {
          setImages((prev) => [...prev, ...newImages]);
        }
      };
      
      reader.readAsDataURL(file);
    });
  }, [canUploadVideo]);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onImagesSave(images.map(img => ({ ...img, type: img.type || 'image' as const })));
    onClose();
  };

  const handleClickArea = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Drag and Drop / Click Area */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClickArea}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
            ${isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={canUploadVideo ? "image/*,video/*" : "image/*"}
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-1">
                {isDragging ? 'Drop files here' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-sm text-gray-500">
                {canUploadVideo ? 'Photos and videos' : 'Photos only'} (PNG, JPG, GIF{canUploadVideo ? ', MP4, MOV' : ''})
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* Selected Images Preview */}
        {images.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Selected ({images.length})
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {images.map((image, index) => (
                <div 
                  key={index} 
                  className="relative group aspect-square"
                >
                  {image.type === 'video' ? (
                    <div className="w-full h-full bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center relative overflow-hidden">
                      <video
                        src={image.url}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={image.url}
                      alt={image.alt || `Image ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border border-gray-300"
                    />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(index);
                    }}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-black text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    aria-label="Remove image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={images.length === 0}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add {images.length > 0 ? `(${images.length})` : ''}
        </button>
      </div>
    </div>
  );
}
