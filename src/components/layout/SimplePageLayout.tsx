'use client';

import React from 'react';
import SimpleNav from './SimpleNav';
import Footer from '@/features/ui/components/Footer';

interface SimplePageLayoutProps {
  children: React.ReactNode;
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
   * Hide the footer (useful when compact footer is present in content)
   */
  hideFooter?: boolean;
  /**
   * Hide the navigation bar (useful for full-screen pages like maps)
   */
  hideNav?: boolean;
  /**
   * Optional toolbar component to render below SimpleNav
   */
  toolbar?: React.ReactNode;
}

/**
 * Simple Page Layout Component for Marketing Pages
 * 
 * Clean, standard website layout with:
 * - Simple navigation bar
 * - Content area
 * - Footer
 * 
 * Use this for public/marketing pages like login, landing pages, terms of service, etc.
 */
export default function SimplePageLayout({
  children,
  containerMaxWidth = '7xl',
  backgroundColor = 'bg-[#f4f2ef]',
  contentPadding = 'px-[10px] py-3',
  hideFooter = false,
  hideNav = false,
  toolbar,
}: SimplePageLayoutProps) {
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
    <div className={`flex flex-col min-h-screen ${backgroundColor}`}>
      {/* Navigation */}
      {!hideNav && <SimpleNav />}

      {/* Toolbar */}
      {toolbar}

      {/* Main Content */}
      <main className={`flex-1 ${maxWidthClass !== 'max-w-full' ? `${maxWidthClass} mx-auto w-full` : 'w-full'} ${contentPadding ? '' : 'h-full'}`}>
        {contentPadding ? (
          <div className={contentPadding}>
            {children}
          </div>
        ) : (
          children
        )}
      </main>

      {/* Footer */}
      {!hideFooter && <Footer />}
    </div>
  );
}
