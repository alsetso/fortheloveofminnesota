/**
 * Shared Components Index
 * 
 * Centralized exports for all shared components organized by category
 */

// Layout Components
export { default as SimplePageLayout } from './layout/SimplePageLayout';
export { default as SimpleNav } from './layout/SimpleNav';
export { default as PageLayout } from './layout/PageLayout';

// Provider Components
export { Providers } from './providers/Providers';
export { ServerAuthProvider, useServerAuth } from './providers/ServerAuthProvider';
export { default as AuthGuard } from './providers/AuthGuard';

// Error Handling Components
export { ErrorBoundary } from './errors/ErrorBoundary';
export { SuspenseBoundary, PageSuspense, AuthSuspense } from './errors/SuspenseBoundary';

// Modal Components
export { default as GlobalModals } from './modals/GlobalModals';
export { default as UpgradeToProModal } from './modals/UpgradeToProModal';

// Utility Components
export { default as LoadingSkeleton, PageLoadingSkeleton, AuthLoadingSkeleton } from './utils/LoadingSkeleton';
export { default as LocalStorageCleanup } from './utils/LocalStorageCleanup';

// Shared Components
export { default as ProfilePhoto } from './shared/ProfilePhoto';
export { default as BaseNav } from './shared/BaseNav';

// UI Components (re-export from ui folder)
export * from './ui';

