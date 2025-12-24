'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { UserIcon, PlusIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { EllipsisHorizontalIcon as EllipsisHorizontalIconSolid } from '@heroicons/react/24/solid';
import { useAuthStateSafe } from '@/features/auth';
import { getMobileNavItems, type MobileNavItemId } from '@/features/sidebar/config/mobileNavConfig';
import { useResponsiveNavItems } from './useResponsiveNavItems';
import MobileNavMorePopup from './MobileNavMorePopup';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface MobileNavProps {
  onCreateClick?: () => void;
  isCreateActive?: boolean;
  onSecondaryContentClick?: (itemId: MobileNavItemId) => void;
  activeSecondaryContent?: MobileNavItemId | null;
  map?: MapboxMapInstance | null;
}

export default function MobileNav({ 
  onCreateClick, 
  isCreateActive = false,
  onSecondaryContentClick,
  activeSecondaryContent = null,
  map,
}: MobileNavProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { account } = useAuthStateSafe();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const profileHref = account?.username ? `/profile/${account.username}` : '/account/settings';
  const isProfileActive = account?.username ? pathname === `/profile/${account.username}` : pathname?.startsWith('/account');
  
  const secondaryNavItems = getMobileNavItems(account);

  // Build all nav items (Secondary items, Create, Profile)
  const allNavItems = [
    ...secondaryNavItems.map(item => ({
      id: item.id,
      type: 'button' as const,
      label: item.label,
      icon: item.icon,
      iconSolid: item.iconSolid,
      isActive: activeSecondaryContent === item.id,
      onClick: () => onSecondaryContentClick?.(item.id),
    })),
    ...(onCreateClick ? [{
      id: 'create',
      type: 'button' as const,
      label: 'Create',
      icon: PlusIcon,
      iconSolid: PlusIcon,
      isActive: isCreateActive,
      onClick: onCreateClick,
    }] : []),
    {
      id: 'profile',
      type: 'link' as const,
      href: profileHref,
      label: 'Profile',
      icon: UserIcon,
      iconSolid: UserIcon,
      isActive: isProfileActive,
    },
  ];

  // Calculate visible vs overflow items
  const { visibleItems, overflowItems, containerRef } = useResponsiveNavItems(allNavItems, {
    minItemWidth: 60,
    containerPadding: 16,
    moreButtonWidth: 60,
  });

  // Render nav item
  const renderNavItem = (item: typeof allNavItems[0]) => {
    const Icon = item.isActive && item.iconSolid ? item.iconSolid : item.icon;
    const baseClasses = "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors";

    if (item.type === 'link') {
      return (
        <Link
          key={item.id}
          href={item.href!}
          className={baseClasses}
        >
          {item.id === 'profile' ? (
            <>
              <div className={`w-5 h-5 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border ${item.isActive ? 'border-gray-900' : 'border-gray-300'}`}>
                {account?.image_url ? (
                  <Image
                    src={account.image_url}
                    alt={account.username || 'Profile'}
                    width={20}
                    height={20}
                    className="w-full h-full object-cover"
                    unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                  />
                ) : (
                  <UserIcon className={`w-3 h-3 ${item.isActive ? 'text-gray-900' : 'text-gray-500'}`} />
                )}
              </div>
              <span className={`text-[10px] font-medium ${item.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </>
          ) : (
            <>
              <Icon className={`w-5 h-5 ${item.isActive ? 'text-gray-900' : 'text-gray-500'}`} />
              <span className={`text-[10px] font-medium ${item.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </>
          )}
        </Link>
      );
    }

    return (
      <button
        key={item.id}
        onClick={item.onClick}
        className={baseClasses}
      >
        {item.id === 'create' ? (
          <>
            <div className={`w-5 h-5 flex items-center justify-center ${item.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
              <PlusIcon className={`w-5 h-5 transition-transform ${item.isActive ? 'rotate-45' : ''}`} />
            </div>
            <span className={`text-[10px] font-medium ${item.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
              {item.label}
            </span>
          </>
        ) : (
          <>
            <Icon className={`w-5 h-5 ${item.isActive ? 'text-gray-900' : 'text-gray-500'}`} />
            <span className={`text-[10px] font-medium ${item.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
              {item.label}
            </span>
          </>
        )}
      </button>
    );
  };

  // Prepare overflow items for popup
  const overflowPopupItems = overflowItems.map(item => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    iconSolid: item.iconSolid,
    isActive: item.isActive,
    onClick: item.type === 'link' 
      ? () => router.push(item.href!)
      : item.onClick || (() => {}),
  }));

  return (
    <>
      <nav 
        ref={containerRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {/* Visible Items */}
          {visibleItems.map(renderNavItem)}

          {/* More Button (if there are overflow items) */}
          {overflowItems.length > 0 && (
            <button
              onClick={() => setIsMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
            >
              {isMoreOpen ? (
                <EllipsisHorizontalIconSolid className="w-5 h-5 text-gray-900" />
              ) : (
                <EllipsisHorizontalIcon className="w-5 h-5 text-gray-500" />
              )}
              <span className={`text-[10px] font-medium ${isMoreOpen ? 'text-gray-900' : 'text-gray-500'}`}>
                More
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* More Popup */}
      {overflowItems.length > 0 && (
        <MobileNavMorePopup
          isOpen={isMoreOpen}
          onClose={() => setIsMoreOpen(false)}
          items={overflowPopupItems}
        />
      )}
    </>
  );
}

