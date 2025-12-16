'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  XMarkIcon,
  HomeIcon,
  MapIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/features/auth';

interface GlobalSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuickLink {
  href: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export default function GlobalSearchOverlay({ isOpen, onClose }: GlobalSearchOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Navigation items based on auth state
  const navigationItems: QuickLink[] = user
    ? [
        { 
          href: '/', 
          label: 'Home', 
          description: 'View your dashboard and features',
          icon: <HomeIcon className="w-5 h-5" />
        },
        { 
          href: '/map', 
          label: 'Map', 
          description: 'Interactive map with community pins',
          icon: <MapIcon className="w-5 h-5" />
        },
        { 
          href: '/account/settings', 
          label: 'Settings', 
          description: 'Account settings and profile',
          icon: <Cog6ToothIcon className="w-5 h-5" />
        },
      ]
    : [
        { 
          href: '/', 
          label: 'Home', 
          description: 'Go to homepage',
          icon: <HomeIcon className="w-5 h-5" />
        },
      ];

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Handle navigation click
  const handleNavClick = (href: string) => {
    router.push(href);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-32 pb-8 px-4 sm:px-6 lg:px-8"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          onClose();
        }
      }}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md -z-10" />

      {/* Glass container */}
      <div className="relative w-full max-w-4xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
          aria-label="Close search"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        {/* Glass panel */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">Navigation</h2>
            <p className="text-sm text-white/60 mt-1">
              {user ? 'Navigate to different sections of the platform' : 'Explore available pages'}
            </p>
          </div>

          {/* Content section */}
          <div className="max-h-[60vh] overflow-y-auto p-6">
            <div className="space-y-2">
              {navigationItems.map((item) => {
                // More precise pathname matching
                let isActive = false;
                if (item.href === '/') {
                  isActive = pathname === '/';
                } else {
                  isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                }
                
                return (
                  <button
                    key={item.href}
                    onClick={() => handleNavClick(item.href)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 group ${
                      isActive
                        ? 'bg-gold-500/20 text-white border border-gold-500/30'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {item.icon && (
                        <div className={`mt-0.5 flex-shrink-0 ${
                          isActive ? 'text-gold-400' : 'text-white/60 group-hover:text-gold-400'
                        } transition-colors`}>
                          {item.icon}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium flex items-center justify-between">
                          <span>{item.label}</span>
                          {isActive && (
                            <span className="text-xs text-gold-400 ml-2">Current</span>
                          )}
                        </div>
                        {item.description && (
                          <div className="text-sm text-white/60 mt-0.5">{item.description}</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

