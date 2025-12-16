'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function LegalFooter() {
  const pathname = usePathname();

  const legalLinks = [
    { href: '/legal/terms-of-service', label: 'Terms of Service' },
    { href: '/legal/user-agreement', label: 'User Agreement' },
    { href: '/legal/privacy-policy', label: 'Privacy Policy' },
    { href: '/legal/community-guidelines', label: 'Community Guidelines' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <footer className="bg-white border-t border-gray-200 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Logo and Tagline */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Image
              src="/word_logo.png"
              alt="MNUDA"
              width={100}
              height={20}
              className="w-[100px] h-auto"
            />
          </div>
          <p className="text-sm text-gray-600">For the Love of Minnesota</p>
        </div>

        {/* Legal Links - LinkedIn Style */}
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          {legalLinks.map((link, index) => (
            <span key={link.href} className="flex items-center">
              {index > 0 && <span className="text-gray-300 mr-4">|</span>}
              <Link
                href={link.href}
                className={`transition-colors ${
                  pathname === link.href
                    ? 'text-black font-semibold'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                {link.label}
              </Link>
            </span>
          ))}
        </nav>

        {/* Copyright */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} MNUDA. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

