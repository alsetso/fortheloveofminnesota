'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserIcon, CreditCardIcon, XMarkIcon, ChartBarIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { AccountService } from '@/features/auth';

interface AccountSidebarProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
}

export default function AccountSidebar({ className = '', isOpen = true, onClose }: AccountSidebarProps) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        const account = await AccountService.getCurrentAccount();
        setIsAdmin(account?.role === 'admin');
        setIsOnboarded(account?.onboarded ?? false);
      } catch (error) {
        console.error('Error fetching account data:', error);
        setIsAdmin(false);
        setIsOnboarded(false);
      }
    };

    fetchAccountData();
  }, []);

  const navItems: NavItem[] = [
    { href: '/account/analytics', label: 'Analytics', icon: ChartBarIcon },
    { 
      href: '/account/onboarding', 
      label: 'Onboarding', 
      icon: SparklesIcon,
      badge: isOnboarded === false ? 'Required' : isOnboarded === true ? 'Completed' : null
    },
    { href: '/account/settings', label: 'Settings', icon: UserIcon },
    { href: '/account/billing', label: 'Billing', icon: CreditCardIcon },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {onClose && (
        <>
          {isOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={onClose}
            />
          )}
        </>
      )}
      
      {/* Sidebar */}
      <nav className={`
        ${onClose ? 'fixed md:relative' : 'relative'}
        ${onClose && !isOpen ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
        top-0 left-0 h-full z-50
        w-60 flex-shrink-0 bg-white border border-gray-200 rounded-md
        transition-transform duration-300 ease-in-out
        ${className}
      `}>
        {/* Mobile close button */}
        {onClose && (
          <div className="flex items-center justify-between p-[10px] border-b border-gray-200 md:hidden rounded-t-md">
            <span className="text-xs font-semibold text-gray-900">Menu</span>
            <button
              onClick={onClose}
              className="p-[10px] hover:bg-gray-50 rounded-md transition-colors"
              aria-label="Close menu"
            >
              <XMarkIcon className="w-4 h-4 text-gray-900" />
            </button>
          </div>
        )}
        
        <ul className={`flex flex-col gap-2 p-[10px] overflow-y-auto h-full ${onClose ? '' : 'rounded-md'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            const hasBadge = item.badge !== null && item.badge !== undefined;
            
            return (
              <li key={item.href} className="flex-shrink-0">
                <Link
                  href={item.href}
                  onClick={() => {
                    // Close mobile menu when navigating
                    if (onClose) {
                      onClose();
                    }
                  }}
                  className={`flex items-center justify-between gap-2 border rounded-md p-[10px] text-xs font-medium transition-colors ${
                    isActive 
                      ? 'border-gray-200 bg-gray-100 text-gray-600' 
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </div>
                  {hasBadge && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      item.badge === 'Required'
                        ? 'bg-yellow-100 text-yellow-800'
                        : item.badge === 'Completed'
                        ? 'bg-green-100 text-green-800'
                        : ''
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

