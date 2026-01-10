'use client';

import { useEffect, useState } from 'react';

export function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('Service Worker registered:', reg);
            setRegistration(reg);

            // Check for updates immediately
            reg.update();

            // Listen for updates
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker is available
                    setUpdateAvailable(true);
                  }
                });
              }
            });

            // Check for updates periodically (every hour)
            setInterval(() => {
              reg.update();
            }, 60 * 60 * 1000);
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
      });
    }
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      // Tell the service worker to skip waiting and activate
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      // Reload the page
      window.location.reload();
    }
  };

  if (updateAvailable) {
    return (
      <div className="fixed bottom-3 left-3 right-3 z-50 bg-white border border-gray-200 rounded-md p-[10px] shadow-sm max-w-md mx-auto">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-900">Update Available</p>
            <p className="text-xs text-gray-600 mt-0.5">
              A new version is available. Refresh to update.
            </p>
          </div>
          <button
            onClick={handleUpdate}
            className="text-xs font-medium px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            Update
          </button>
        </div>
      </div>
    );
  }

  return null;
}

