'use client';

import { useState, useEffect } from 'react';
import { GlobeAltIcon, LockClosedIcon, PhotoIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { FeedPostData } from './FeedPost';
import PostMapModal, { PostMapData } from './PostMapModal';
import Image from 'next/image';

interface EditPostModalProps {
  isOpen: boolean;
  post: FeedPostData | null;
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditPostModal({ isOpen, post, onClose, onUpdate }: EditPostModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'draft'>('public');
  const [images, setImages] = useState<Array<{ url: string; filename: string; type?: string }>>([]);
  const [mapData, setMapData] = useState<PostMapData | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with post data
  useEffect(() => {
    if (post) {
      setTitle(post.title || '');
      setContent(post.content || '');
      setVisibility((post.visibility as 'public' | 'draft') || 'public');
      setImages(post.images || []);
      
      // Initialize map data from post
      if (post.map_data) {
        setMapData({
          type: post.map_data.type as 'pin' | 'area' | 'both',
          geometry: post.map_data.geometry,
          center: post.map_data.center,
          polygon: post.map_data.polygon,
          screenshot: post.map_data.screenshot,
          hidePin: false,
        });
      } else if (post.map_geometry || post.map_type) {
        // Convert from structured columns to map_data format
        const center = post.map_center && typeof post.map_center === 'object' && 'coordinates' in post.map_center
          ? post.map_center.coordinates as [number, number]
          : undefined;
        
        setMapData({
          type: (post.map_type as 'pin' | 'area' | 'both') || 'pin',
          geometry: post.map_geometry as GeoJSON.Point | GeoJSON.Polygon | GeoJSON.MultiPolygon,
          center,
          screenshot: post.map_screenshot || undefined,
          hidePin: post.map_hide_pin || false,
        });
      } else {
        setMapData(null);
      }
    }
  }, [post]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting || !post) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const updateData: Record<string, unknown> = {
        content: content.trim(),
        visibility,
        images: images.length > 0 ? images : null,
      };

      // Add title if provided, otherwise auto-generate from content
      if (title.trim()) {
        updateData.title = title.trim().substring(0, 200);
      } else {
        updateData.title = content.trim().split('\n')[0].substring(0, 200) || null;
      }

      // Add map_data if exists
      if (mapData) {
        updateData.map_data = mapData;
      } else {
        // Clear map data if removed
        updateData.map_data = null;
      }

      const response = await fetch(`/api/feed/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update post' }));
        throw new Error(errorData.error || 'Failed to update post');
      }

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating post:', error);
      setError(error instanceof Error ? error.message : 'Failed to update post');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleMapSave = (newMapData: PostMapData | null) => {
    setMapData(newMapData);
    setShowMapModal(false);
  };

  const handleRemoveMap = () => {
    setMapData(null);
  };

  if (!isOpen || !post) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
        <div
          className="bg-white rounded-md border border-gray-200 shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Compact Header */}
          <div className="flex items-center justify-between px-[10px] py-2 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">Edit Post</h2>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-[10px] space-y-3">
              {error && (
                <div className="px-2 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
                  {error}
                </div>
              )}

              {/* Title - Optional */}
              <div>
                <label htmlFor="edit-title" className="block text-xs font-medium text-gray-700 mb-1">
                  Title (optional)
                </label>
                <input
                  id="edit-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Post title..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>

              {/* Content */}
              <div>
                <label htmlFor="edit-content" className="block text-xs font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  id="edit-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What do you want to talk about?"
                  rows={6}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-transparent"
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* Images Preview */}
              {images.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Images</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {images.map((image, index) => (
                      <div key={index} className="relative aspect-video bg-gray-100 rounded-md overflow-hidden group">
                        <Image
                          src={image.url}
                          alt={`Image ${index + 1}`}
                          fill
                          className="object-cover"
                          unoptimized={image.url.includes('supabase.co')}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 p-0.5 bg-black/70 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove image"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Note: Adding new images requires recreating the post</p>
                </div>
              )}

              {/* Map Preview */}
              {mapData && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Map</label>
                  <div className="relative aspect-video bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                    {mapData.screenshot ? (
                      <Image
                        src={mapData.screenshot}
                        alt="Map"
                        fill
                        className="object-cover"
                        unoptimized={mapData.screenshot.startsWith('data:')}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <MapPinIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white px-1.5 py-0.5 rounded text-[10px] font-medium">
                      {mapData.type === 'both' ? 'Pin + Area' : mapData.type === 'area' ? 'Area' : 'Pin'}
                    </div>
                    <div className="absolute top-1 right-1 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setShowMapModal(true)}
                        className="px-2 py-1 bg-white/90 hover:bg-white text-gray-700 rounded text-[10px] font-medium transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveMap}
                        className="px-2 py-1 bg-white/90 hover:bg-white text-red-600 rounded text-[10px] font-medium transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Map Button */}
              {!mapData && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowMapModal(true)}
                    className="w-full px-2 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <MapPinIcon className="w-4 h-4" />
                    Add Map
                  </button>
                </div>
              )}

              {/* Visibility Selector - Compact */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Visibility</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      visibility === 'public'
                        ? 'bg-blue-50 text-blue-700 border border-blue-300'
                        : 'bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100'
                    }`}
                    disabled={isSubmitting}
                  >
                    <GlobeAltIcon className="w-3.5 h-3.5" />
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility('draft')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      visibility === 'draft'
                        ? 'bg-gray-200 text-gray-700 border border-gray-400'
                        : 'bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100'
                    }`}
                    disabled={isSubmitting}
                  >
                    <LockClosedIcon className="w-3.5 h-3.5" />
                    Draft
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Compact Footer */}
          <div className="flex items-center justify-end gap-2 px-[10px] py-2 border-t border-gray-200 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs text-gray-700 font-medium hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
              className="px-3 py-1.5 text-xs bg-gray-900 text-white font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Map Modal */}
      {showMapModal && (
        <PostMapModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          initialMapData={mapData}
          onSave={handleMapSave}
        />
      )}
    </>
  );
}
