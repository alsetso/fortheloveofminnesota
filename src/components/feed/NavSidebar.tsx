'use client';

import Link from 'next/link';
import { 
  MapIcon, 
  HomeIcon, 
  UserIcon, 
  Cog6ToothIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';

export default function NavSidebar() {
  const pathname = usePathname();

  const navItems = [
    { icon: HomeIcon, href: '/', label: 'Home' },
    { icon: MapIcon, href: '/map', label: 'Map' },
    { icon: MagnifyingGlassIcon, href: '/', label: 'Search' },
    { icon: Cog6ToothIcon, href: '/account/settings', label: 'Settings' },
  ];

  return (
    <div 
      className="fixed left-0 top-0 bottom-0 z-30 flex flex-col items-center py-4 px-2"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
      }}
    >
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname?.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center justify-center w-10 h-10 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-gray-200 text-gray-900' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }
              `}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}



