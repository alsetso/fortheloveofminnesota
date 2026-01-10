'use client';

import { useEffect, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function DownloadPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Listen for beforeinstallprompt event (not available on iOS)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Only listen for beforeinstallprompt on non-iOS devices
    if (!isIOSDevice) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }

    return () => {
      if (!isIOSDevice) {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      }
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
      } catch (error) {
        // Prompt failed, show instructions
        setShowInstructions(true);
      }
    } else {
      // No prompt available - show instructions
      // User may need to use browser's native install button
      setShowInstructions(true);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleInstall}
        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors"
      >
        <ArrowDownTrayIcon className="w-4 h-4" />
        <span>Install PWA</span>
      </button>

      {showInstructions && (
        <div className="p-2 bg-gray-50 border border-gray-200 rounded-md space-y-1.5 text-xs text-gray-600">
          <p className="font-medium text-gray-900">Installation Instructions:</p>
          {!isIOS && (
            <p className="text-gray-700 mb-1.5">
              Look for the install icon (⊕) in your browser's address bar, or follow the steps below:
            </p>
          )}
          <ul className="space-y-1 pl-4 list-disc">
            {isIOS ? (
              <li>
                <strong>iOS Safari:</strong> Tap the Share button (square with arrow) → Scroll down and tap "Add to Home Screen"
              </li>
            ) : (
              <>
                <li>
                  <strong>Android Chrome:</strong> Tap menu (⋮) → "Install app" or "Add to Home screen"
                </li>
                <li>
                  <strong>Desktop Chrome/Edge:</strong> Look for install icon (⊕) in the address bar, or go to menu (⋮) → Install
                </li>
                <li>
                  <strong>Desktop Safari:</strong> File → Add to Dock (Mac) or use Share menu
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

