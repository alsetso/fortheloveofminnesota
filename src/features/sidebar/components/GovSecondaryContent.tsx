'use client';

import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

interface GovMenuItem {
  label: string;
  href: string;
  children?: GovMenuItem[];
}

const govMenuItems: GovMenuItem[] = [
  {
    label: 'State Government',
    href: '/gov/state',
    children: [
      { label: 'Executive Branch', href: '/gov/state/executive' },
      { label: 'Legislative Branch', href: '/gov/state/legislative' },
      { label: 'Judicial Branch', href: '/gov/state/judicial' },
    ],
  },
];

export default function GovSecondaryContent() {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Government Resources</div>
        <div className="space-y-0.5">
          {govMenuItems.map((item) => (
            <div key={item.href}>
              <Link
                href={item.href}
                className="flex items-center justify-between px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <span>{item.label}</span>
                {item.children && (
                  <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                )}
              </Link>
              {item.children && (
                <div className="ml-4 space-y-0.5 mt-0.5">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block px-2 py-1.5 rounded text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <Link
          href="/gov"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          Learn More
        </Link>
      </div>
    </div>
  );
}

