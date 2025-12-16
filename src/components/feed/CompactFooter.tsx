'use client';

import Link from 'next/link';
import Logo from '@/features/ui/components/Logo';

export default function CompactFooter() {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      {/* Navigation Links */}
      <nav aria-label="Footer navigation">
        <ul className="space-y-2">
          <li>
            <Link 
              href="/" 
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Home
            </Link>
          </li>
          <li>
            <Link 
              href="/map" 
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Map
            </Link>
          </li>
          <li>
            <Link 
              href="/explore" 
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Explore
            </Link>
          </li>
          <li>
            <Link 
              href="/" 
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Feed
            </Link>
          </li>
        </ul>
      </nav>

      {/* Contact Link */}
      <div className="pt-3 border-t border-gray-200">
        <ul className="space-y-1.5">
          <li>
            <Link 
              href="/contact" 
              className="text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
            >
              Contact
            </Link>
          </li>
        </ul>
      </div>

      {/* Logo & Copyright */}
      <div className="pt-3 border-t border-gray-200">
        <Logo size="sm" variant="default" />
        <p className="text-[10px] text-gray-500 mt-1.5">
          © {new Date().getFullYear()} For the Love of Minnesota. All rights reserved.
        </p>
      </div>
    </div>
  );
}


