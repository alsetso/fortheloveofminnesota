'use client';

import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

interface GovMenuItem {
  label: string;
  href: string;
  children?: GovMenuItem[];
}

const govMenuItems: GovMenuItem[] = [];

export default function GovSecondaryContent() {
  return (
    <div className="space-y-3">
      <div className="border-t border-gray-200 pt-3">
        <Link
          href="/gov"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          View Directory
        </Link>
      </div>
    </div>
  );
}

