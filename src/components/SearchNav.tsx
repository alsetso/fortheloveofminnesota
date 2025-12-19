'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth';
import BaseNav from './shared/BaseNav';

export default function SearchNav() {
  const { user } = useAuth();

  const rightSection = (
    <div className="flex items-center gap-4">
      <Link
        href="/"
        className="text-sm text-gray-600 hover:text-black transition-colors"
      >
        Back to Home
      </Link>
      {user ? (
        <Link
          href="/map"
          className="px-4 py-1.5 text-sm font-medium rounded transition-all duration-200 text-white bg-blue-600 hover:bg-blue-700"
        >
          Go to Map
        </Link>
      ) : (
        <Link
          href="/?modal=welcome"
          className="px-4 py-1.5 text-sm font-medium border rounded transition-all duration-200 text-blue-600 border-blue-600 hover:bg-blue-50"
        >
          Sign In
        </Link>
      )}
    </div>
  );

  const mobileMenuContent = (
    <>
      <div className="space-y-2">
        <Link
          href="/"
          className="block px-3 py-2 text-base font-medium transition-colors text-gray-600 hover:text-black hover:bg-gray-100"
        >
          Back to Home
        </Link>
        {user ? (
          <Link
            href="/map"
            className="block px-3 py-2 text-base font-medium rounded-lg transition-colors text-center text-white bg-blue-600 hover:bg-blue-700"
          >
            Go to Map
          </Link>
        ) : (
          <Link
            href="/?modal=welcome"
            className="block px-3 py-2 text-base font-medium border-2 rounded-lg transition-colors text-center text-blue-600 border-blue-600 hover:bg-blue-50"
          >
            Sign In
          </Link>
        )}
      </div>
    </>
  );

  return (
    <BaseNav
      navLinks={[]}
      rightSection={rightSection}
      mobileMenuContent={mobileMenuContent}
    />
  );
}

