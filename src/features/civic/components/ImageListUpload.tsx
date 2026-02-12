'use client';

import { useRef, type ChangeEvent } from 'react';
import { useImageUpload } from '@/hooks/useImageUpload';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ImageListUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  pathPrefix: string;
  bucket?: string;
  label?: string;
  onError?: (error: Error) => void;
  className?: string;
}

/**
 * Drag-and-drop or click-to-upload zone plus a list of thumbnails with remove.
 * Use for building cover_images or any list of image URLs.
 */
export default function ImageListUpload({
  value,
  onChange,
  pathPrefix,
  bucket = STORAGE_BUCKETS.CIVIC_BUILDING_COVER,
  label = 'Cover images',
  onError,
  className = '',
}: ImageListUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    uploading,
    isDragging,
    handleUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useImageUpload({
    bucket,
    onSuccess: (url) => onChange([...value, url]),
    onError: onError ?? (() => {}),
  });

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      try {
        await handleUpload(file, pathPrefix);
      } catch {
        // onError called in hook
      }
    }
    e.target.value = '';
  };

  const handleDropMultiple = (e: React.DragEvent) => {
    e.preventDefault();
    handleDragLeave(e);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    const doNext = async (idx: number) => {
      if (idx >= files.length) return;
      try {
        await handleUpload(files[idx], pathPrefix);
        await doNext(idx + 1);
      } catch {
        await doNext(idx + 1);
      }
    };
    doNext(0);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-[10px] font-medium text-foreground mb-0.5">
          {label}
        </label>
      )}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropMultiple}
        onClick={handleClick}
        className={`rounded-md border-2 border-dashed transition-colors min-h-[80px] flex flex-col items-center justify-center gap-2 p-3 ${
          isDragging
            ? 'border-accent bg-accent-light/10 dark:bg-accent/20'
            : 'border-border hover:border-foreground-muted hover:bg-surface-accent'
        } ${uploading ? 'opacity-70 pointer-events-none' : 'cursor-pointer'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <PhotoIcon className="w-6 h-6 text-foreground-muted" />
        <span className="text-xs text-foreground-muted">
          {uploading ? 'Uploading…' : 'Drop images or click to upload'}
        </span>
      </div>
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {value.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className="relative w-16 h-16 rounded-md overflow-hidden border border-border flex-shrink-0 bg-surface-accent"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(index);
                }}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                aria-label="Remove image"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
