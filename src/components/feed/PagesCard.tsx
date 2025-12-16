'use client';

import Link from 'next/link';
import type { Account } from '@/features/auth';

interface PagesCardProps {
  account?: Account | null;
}

export default function PagesCard({ account }: PagesCardProps) {
  return (
    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
      <div className="px-[10px] py-[10px]">
        <div className="space-y-1.5">
          <Link 
            href="/account/change-plan"
            className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-900 transition-colors"
          >
            <div className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center">
              <span className="text-[8px] font-bold text-gray-700">★</span>
            </div>
            <span>Premium</span>
          </Link>
        </div>
      </div>
    </div>
  );
}


