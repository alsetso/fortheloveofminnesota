'use client';

import { useState, useEffect } from 'react';
import { PhotoIcon, MapPinIcon, XMarkIcon, GlobeAltIcon, UserGroupIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import ProfilePhoto from '@/components/ProfilePhoto';
import { useAuth, AccountService, Account } from '@/features/auth';
import { useProfile } from '@/features/profiles/contexts/ProfileContext';
import { supabase } from '@/lib/supabase';

interface CreatePostFormProps {
  onPostCreated?: () => void;
}

export default function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const { user } = useAuth();
  const { selectedProfile } = useProfile();
  const [account, setAccount] = useState<Account | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'members_only' | 'draft'>('members_only');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'submitting' | 'complete'>('idle');
  const [images, setImages] = useState<Array<{ url: string; filename: string; type?: string; poster?: string }>>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load account data for profile photo
  useEffect(() => {
    if (user) {
      AccountService.getCurrentAccount()
        .then(setAccount)
        .catch((err) => {
          console.error('Error loading account:', err);
        });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting || !user || !account) return;

    setIsSubmitting(true);
    setError(null);
    setUploadProgress(0);
    setUploadStage('idle');

    try {
      // Refresh session using getUser() - this ensures cookies are set
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        console.error('Session refresh failed:', userError);
        setError('Please sign in to create posts');
        setTimeout(() => setError(null), 3000);
        setIsSubmitting(false);
        setUploadStage('idle');
        return;
      }

      // Get session to ensure access token is available
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session after getUser()');
        setError('Session expired. Please refresh the page');
        setTimeout(() => setError(null), 3000);
        setIsSubmitting(false);
        setUploadStage('idle');
        return;
      }

      // Upload files to Supabase storage first
      const uploadedImages: Array<{ url: string; filename: string; type: string; thumbnail_url?: string }> = [];
      const totalFiles = imageFiles.filter(f => 
        f.type.startsWith('image/') || f.type.startsWith('video/')
      ).length;
      
      if (imageFiles.length > 0) {
        setUploadStage('uploading');
        let uploadedCount = 0;
        
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const isImage = file.type.startsWith('image/');
          const isVideo = file.type.startsWith('video/');
          
          if (!isImage && !isVideo) continue;

          // Generate unique filename
          const fileExt = file.name.split('.').pop();
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(7);
          const fileName = `${user.id}/feed/${timestamp}-${random}.${fileExt}`;

          // Upload to Supabase storage
          const { error: uploadError } = await supabase.storage
            .from('feed-images')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('feed-images')
            .getPublicUrl(fileName);

          if (!urlData?.publicUrl) {
            throw new Error(`Failed to get URL for ${file.name}`);
          }

          let thumbnailUrl: string | undefined;
          
          // Upload thumbnail for videos
          if (isVideo) {
            try {
              const { generateVideoThumbnail } = await import('./utils/videoThumbnail');
              const thumbnail = await generateVideoThumbnail(file);
              
              const thumbFileName = `${user.id}/feed/thumbnails/${timestamp}-${random}.jpg`;
              const { error: thumbError } = await supabase.storage
                .from('feed-images')
                .upload(thumbFileName, thumbnail.blob, {
                  cacheControl: '3600',
                  upsert: false,
                  contentType: 'image/jpeg',
                });

              if (!thumbError) {
                const { data: thumbUrlData } = supabase.storage
                  .from('feed-images')
                  .getPublicUrl(thumbFileName);
                thumbnailUrl = thumbUrlData?.publicUrl;
              }
            } catch (err) {
              console.warn('Thumbnail upload failed:', err);
            }
          }

          uploadedImages.push({
            url: urlData.publicUrl,
            filename: file.name,
            type: file.type,
            thumbnail_url: thumbnailUrl,
          });

          // Update progress: 80% for file uploads (reserve 20% for API submission)
          uploadedCount++;
          const fileUploadProgress = (uploadedCount / totalFiles) * 80;
          setUploadProgress(fileUploadProgress);
        }
      }

      // Update stage to submitting
      setUploadStage('submitting');
      setUploadProgress(85); // Start of API submission

      const response = await fetch('/api/feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          images: uploadedImages,
          visibility,
          account_id: account?.id,
        }),
      });

      setUploadProgress(95); // Near completion

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create post' }));
        throw new Error(errorData.error || 'Failed to create post');
      }

      // Complete
      setUploadProgress(100);
      setUploadStage('complete');

      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 300));

      // Revoke all blob URLs to free memory
      images.forEach(img => {
        if (img.url?.startsWith('blob:')) {
          URL.revokeObjectURL(img.url);
        }
      });

      // Reset form
      setTitle('');
      setContent('');
      setImages([]);
      setImageFiles([]);
      setVisibility('members_only');
      setIsExpanded(false);
      setUploadProgress(0);
      setUploadStage('idle');
      onPostCreated?.();
    } catch (error) {
      console.error('Error creating post:', error);
      setError(error instanceof Error ? error.message : 'Failed to create post');
      setTimeout(() => setError(null), 3000);
      setUploadProgress(0);
      setUploadStage('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // Store File objects for later upload
    setImageFiles(prev => [...prev, ...fileArray]);

    // Create preview URLs with thumbnails for videos
    const newImagesPromises = fileArray.map(async (file) => {
      const blobUrl = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/');
      
      let poster: string | undefined;
      if (isVideo) {
        try {
          const { generateVideoThumbnail } = await import('./utils/videoThumbnail');
          const result = await generateVideoThumbnail(file);
          poster = result.dataUrl;
        } catch (err) {
          console.warn('Thumbnail generation failed:', err);
        }
      }
      
      return {
        url: blobUrl,
        filename: file.name,
        type: file.type,
        poster,
      };
    });

    const newImages = await Promise.all(newImagesPromises);
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    // Revoke blob URL to free memory
    const imageToRemove = images[index];
    if (imageToRemove?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    setImages(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (!user) return null;

  return (
    <div className="bg-white border border-[#dfdedc] rounded-lg p-4 mb-4">
      <form onSubmit={handleSubmit}>
        {!isExpanded ? (
          <div
            onClick={() => {
              if (!selectedProfile) {
                setError('Please select a profile to create posts');
                setTimeout(() => setError(null), 3000);
                return;
              }
              setIsExpanded(true);
            }}
            className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-text hover:border-gray-400 transition-colors"
          >
            <ProfilePhoto 
              account={account}
              size="md" 
            />
            <span className="text-gray-500 flex-1">
              Start a post...
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Upload Progress Bar */}
            {(uploadStage === 'uploading' || uploadStage === 'submitting' || uploadStage === 'complete') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-medium">
                    {uploadStage === 'uploading' && 'Uploading files...'}
                    {uploadStage === 'submitting' && 'Creating post...'}
                    {uploadStage === 'complete' && 'Post created!'}
                  </span>
                  <span className="text-gray-500">{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gold-500 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                {uploadStage === 'uploading' && imageFiles.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Uploading {imageFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')).length} file{imageFiles.length !== 1 ? 's' : ''}...
                  </p>
                )}
              </div>
            )}
            {!selectedProfile && (
              <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-sm">
                Please select a profile to create posts
              </div>
            )}
            <div className="flex items-start gap-3">
              <ProfilePhoto 
                account={account}
                size="md" 
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Post title..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent mb-2"
                  autoFocus
                  disabled={!selectedProfile}
                />
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What do you want to talk about?"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent disabled:opacity-50"
                  disabled={!selectedProfile}
                />
              </div>
            </div>

            {/* Visibility Selector */}
            <div className="flex items-center gap-2 px-3">
              <span className="text-sm text-gray-600">Visibility:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    visibility === 'public'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  }`}
                  disabled={!selectedProfile}
                >
                  <GlobeAltIcon className="w-4 h-4" />
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('members_only')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    visibility === 'members_only'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  }`}
                  disabled={!selectedProfile}
                >
                  <UserGroupIcon className="w-4 h-4" />
                  Members Only
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('draft')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    visibility === 'draft'
                      ? 'bg-gray-200 text-gray-700 border-2 border-gray-400'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  }`}
                  disabled={!selectedProfile}
                >
                  <LockClosedIcon className="w-4 h-4" />
                  Draft
                </button>
              </div>
            </div>

            {/* Media Preview */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {images.map((image, idx) => {
                  const isVideo = image.type?.startsWith('video/');
                  return (
                  <div key={idx} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden group">
                    {isVideo ? (
                      <video 
                        src={image.url}
                        poster={image.poster}
                        className="w-full h-full object-cover" 
                        controls
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img 
                        src={image.url} 
                        alt={`Preview ${idx + 1} for ${title || 'post'}`} 
                        className="w-full h-full object-cover" 
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <XMarkIcon className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                  <PhotoIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">Photo/Video</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <MapPinIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">Location</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Revoke all blob URLs to free memory
                    images.forEach(img => {
                      if (img.url?.startsWith('blob:')) {
                        URL.revokeObjectURL(img.url);
                      }
                    });
                    setIsExpanded(false);
                    setTitle('');
                    setContent('');
                    setImages([]);
                    setImageFiles([]);
                  }}
                  className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || !content.trim() || isSubmitting || !selectedProfile}
                  className="px-4 py-2 bg-gold-500 text-black font-semibold rounded-lg hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Posting...' : visibility === 'draft' ? 'Save Draft' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

