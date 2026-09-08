'use client';

/**
 * Contacts book sheet — thin alias over the shared FullScreenSheetShell so
 * existing Contacts imports keep working. Prefer FullScreenSheetShell for new
 * full-viewport sheets (Create Post, etc.).
 */

export {
  default,
  type FullScreenSheetShellProps as ContactsSheetShellProps,
} from '@/components/sheets/FullScreenSheetShell';
