/**
 * Standardized error messages for the application
 */

export const ERROR_MESSAGES = {
  // Generic errors
  GENERIC_UPDATE_FAILED: 'Failed to update. Please try again.',
  GENERIC_LOAD_FAILED: 'Failed to load data. Please refresh the page.',
  GENERIC_SAVE_FAILED: 'Failed to save changes. Please try again.',
  
  // Authentication errors
  AUTH_REQUIRED: 'Please sign in to perform this action.',
  AUTH_UPLOAD_REQUIRED: 'Please sign in to upload images',
  
  // Validation errors
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_URL: 'Please enter a valid URL (starting with http:// or https://).',
  INVALID_SLUG: 'Slug must contain only lowercase letters, numbers, and hyphens.',
  REQUIRED_FIELD: 'This field is required.',
  
  // File upload errors
  INVALID_IMAGE_TYPE: 'Please select a valid image file.',
  IMAGE_TOO_LARGE: 'Image must be smaller than 5MB.',
  UPLOAD_FAILED: 'Failed to upload image. Please try again.',
  
  // Network errors
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
} as const;

export type ErrorMessage = typeof ERROR_MESSAGES[keyof typeof ERROR_MESSAGES];

