/**
 * Storage-related constants for Supabase storage buckets
 */

export const STORAGE_BUCKETS = {
  GOV_PEOPLE: 'gov-people-storage',
  PROFILE_IMAGES: 'profile-images',
  COVER_PHOTOS: 'cover-photos',
  ID_VERIFICATION: 'id-verification-documents',
} as const;

export const STORAGE_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  CACHE_CONTROL: '3600', // 1 hour
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
} as const;

