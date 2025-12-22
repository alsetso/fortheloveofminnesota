'use client';

import React from 'react';

/**
 * @deprecated PageLayout is deprecated. Use AppWrapper for app pages or SimplePageLayout for public/marketing pages.
 * 
 * This component has been refactored to remove AppHeader and Footer dependencies.
 * It now serves as a simple content wrapper with container and styling options.
 * 
 * Migration:
 * - For app pages: Replace <PageLayout> with <AppWrapper>
 * - For public/marketing pages: Use <SimplePageLayout> instead
 */
interface PageLayoutProps {
  children: React.ReactNode;
  /**
   * @deprecated Header is no longer rendered. Use AppWrapper for app pages.
   */
  showHeader?: boolean;
  /**
   * @deprecated Footer is no longer rendered. Use SimplePageLayout for public pages with footer.
   */
  showFooter?: boolean;
  /**
   * @deprecated Header props are no longer used.
   */
  headerProps?: Record<string, unknown>;
  /**
   * Page container max width class
   */
  containerMaxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
  /**
   * Background color class
   */
  backgroundColor?: string;
  /**
   * Padding class for main content
   */
  contentPadding?: string;
  /**
   * @deprecated Server auth is no longer used.
   */
  serverAuth?: unknown;
}

/**
 * Simple Content Wrapper Component
 * 
 * Legacy wrapper that provides container, background, and padding styling.
 * 
 * NOTE: This component no longer renders header or footer.
 * - Use AppWrapper for app pages (includes AppTop header and AppContent)
 * - Use SimplePageLayout for public/marketing pages (includes SimpleNav and Footer)
 */
export default function PageLayout({
  children,
  showHeader: _showHeader,
  showFooter: _showFooter,
  headerProps: _headerProps,
  containerMaxWidth = '7xl',
  backgroundColor = 'bg-[#f4f2ef]',
  contentPadding = 'px-4 sm:px-6 lg:px-8 py-8',
  serverAuth: _serverAuth,
}: PageLayoutProps) {
  const maxWidthClass = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  }[containerMaxWidth];

  return (
    <div 
      className={`flex flex-col min-h-screen ${backgroundColor}`} 
      style={{ 
        margin: 0, 
        padding: 0, 
        width: '100%',
        maxWidth: '100vw',
        position: 'relative'
      }}
    >
      {/* Main Content */}
      <main 
        className={`flex-1 ${maxWidthClass !== 'max-w-full' ? `${maxWidthClass} mx-auto w-full` : 'w-full'}`} 
        style={{ 
          maxWidth: '100vw', 
          margin: 0, 
          padding: 0,
          width: '100%',
          position: 'relative'
        }}
      >
        <div 
          className={contentPadding || ''} 
          style={contentPadding ? { margin: 0, width: '100%' } : { width: '100%', margin: 0, padding: 0 }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

