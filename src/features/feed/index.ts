/**
 * Feed feature exports
 */

// Types
export * from './types';

// Services
export { PostService } from './services/postService';
export { MediaUploadService } from './services/mediaUploadService';
export type { Post, CreatePostResponse, GetPostsResponse } from './services/postService';

// Hooks
export { usePostCreation } from './hooks/usePostCreation';
export { useMediaUpload } from './hooks/useMediaUpload';
export type { UsePostCreationReturn, UsePostCreationOptions } from './hooks/usePostCreation';
export type { UseMediaUploadReturn, UseMediaUploadOptions } from './hooks/useMediaUpload';

// Components
export { default as FeedPost } from './components/FeedPost';
export type { FeedPostData } from './components/FeedPost';
export { default as FeedList } from './components/FeedList';
export { default as LocationPostsFeed } from './components/LocationPostsFeed';
export { default as PostMapModal } from './components/PostMapModal';
export type { PostMapData } from './components/PostMapModal';
export { default as PostMapRenderer } from './components/PostMapRenderer';
export { default as PostPublisherModal } from './components/PostPublisherModal';
export { default as MediaUploadEditor } from './components/MediaUploadEditor';
export { default as PageLoadingOverlay } from './components/PageLoadingOverlay';

// Utils
export {
  isSafeUrl,
  filterValidMedia,
  isVideo,
  formatLocationBreadcrumb,
  getPostUrl,
  getProfileUrl,
  isValidPost,
  getMediaGridColumns,
  truncateText,
} from './utils/feedHelpers';

export {
  generateVideoThumbnail,
  generateThumbnailFromBlobUrl,
  isVideoFile,
  getVideoMetadata,
} from './utils/videoThumbnail';
export type {
  VideoThumbnailOptions,
  VideoThumbnailResult,
} from './utils/videoThumbnail';
