'use client';

import { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (running in standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user previously installed (stored in localStorage)
    const wasInstalled = localStorage.getItem('pwa-installed');
    if (wasInstalled === 'true') {
      setIsInstalled(true);
      return;
    }

    // Listen for appinstalled event (fires when user installs)
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      localStorage.setItem('pwa-installed', 'true');
    };

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if user has dismissed before (stored in localStorage)
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setShowPrompt(false);
      }
    }

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
      setIsInstalled(true);
      localStorage.setItem('pwa-installed', 'true');
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-3 left-3 right-3 z-50 bg-white border border-gray-200 rounded-md p-[10px] shadow-sm max-w-md mx-auto">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-900">Install Love of Minnesota</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Add to your home screen for quick access
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Dismiss"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleInstall}
          className="flex-1 text-xs font-medium px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="text-xs text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

