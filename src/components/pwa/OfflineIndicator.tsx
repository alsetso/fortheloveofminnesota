'use client';

import { useEffect, useState } from 'react';
import { WifiIcon } from '@heroicons/react/24/outline';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-1.5 flex items-center gap-2">
      <WifiIcon className="w-3 h-3 text-yellow-600" />
      <span className="text-xs font-medium text-yellow-800">Offline - Some features may be limited</span>
    </div>
  );
}

