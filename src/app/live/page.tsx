'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect /live to /map/live
export default function LivePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/map/live');
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-6 h-6 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
