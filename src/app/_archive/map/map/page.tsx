'use client';

import { useState, useEffect } from 'react';
import SimplePageLayout from '@/components/SimplePageLayout';
import { useAuth } from '@/features/auth';

// Force dynamic rendering - prevents static generation
export const dynamic = 'force-dynamic';

export default function MapPage() {
  const [isMounted, setIsMounted] = useState(false);
  const { isLoading: authLoading } = useAuth();
  const [MapComponent, setMapComponent] = useState<React.ComponentType | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    setIsMounted(true);
    // Dynamically construct import path to prevent Next.js static analysis
    const mapPath = './Map' + 'Content';
    import(mapPath)
      .then((mod) => {
        if (mod.default) {
          setMapComponent(() => mod.default);
        } else {
          setImportError('MapContent component not found in module');
        }
      })
      .catch((err) => {
        console.error('Failed to load map component:', err);
        setImportError(err instanceof Error ? err.message : 'Failed to load map component');
      });
  }, []);

  // Don't block on auth loading - map page is public
  // Add timeout to prevent infinite loading
  useEffect(() => {
    if (authLoading) {
      const timeout = setTimeout(() => {
        console.warn('Auth loading timeout - proceeding anyway');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [authLoading]);

  // Show error if import failed
  if (importError) {
    return (
      <SimplePageLayout backgroundColor="bg-black" contentPadding="px-0 py-0" containerMaxWidth="full" hideFooter={true}>
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="bg-white border-2 border-red-500 rounded-lg p-6 max-w-md mx-4">
              <div className="text-red-600 font-bold text-lg mb-2">⚠️ Map Component Error</div>
              <div className="text-gray-700 text-sm mb-4">{importError}</div>
              <div className="text-xs text-gray-500">Check browser console for details</div>
            </div>
          </div>
        </div>
      </SimplePageLayout>
    );
  }

  // Don't wait for auth - map is public
  if (!isMounted || !MapComponent) {
    return (
      <SimplePageLayout backgroundColor="bg-black" contentPadding="px-0 py-0" containerMaxWidth="full" hideFooter={true}>
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-white font-medium">Loading...</div>
            {!isMounted && <div className="text-white text-xs mt-2">Initializing...</div>}
            {isMounted && !MapComponent && <div className="text-white text-xs mt-2">Loading map component...</div>}
          </div>
        </div>
      </SimplePageLayout>
    );
  }

  return <MapComponent />;
}
