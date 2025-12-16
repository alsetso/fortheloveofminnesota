'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

export default function LegalNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const legalLinks = [
    { href: '/legal/terms-of-service', label: 'Terms of Service' },
    { href: '/legal/user-agreement', label: 'User Agreement' },
    { href: '/legal/privacy-policy', label: 'Privacy Policy' },
    { href: '/legal/community-guidelines', label: 'Community Guidelines' },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* First Row - Logo and Back to Home */}
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Image
                src="/word_logo.png"
                alt="MNUDA"
                width={100}
                height={20}
                className="w-[100px] h-auto"
                style={{ maxWidth: '100px', height: 'auto', display: 'block' }}
                priority
              />
            </Link>
          </div>

          {/* Right Side - Desktop Back to Home, Mobile Menu Button */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="hidden md:block text-sm text-gray-600 hover:text-black transition-colors"
            >
              Back to Home
            </Link>
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 transition-colors text-gray-600 hover:text-black"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Second Row - Legal Navigation (Desktop) */}
        <div className="hidden md:block border-t border-gray-200">
          <nav className="flex items-center gap-4 py-3">
            {legalLinks.map((link, index) => (
              <span key={link.href} className="flex items-center">
                {index > 0 && <span className="text-gray-300 mr-4">|</span>}
                <Link
                  href={link.href}
                  className={`text-sm transition-colors ${
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
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="space-y-2">
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 text-base font-medium transition-colors text-gray-600 hover:text-black hover:bg-gray-100"
              >
                Back to Home
              </Link>
              <div className="pt-2 border-t border-gray-200">
                {legalLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-3 py-2 text-base font-medium transition-colors ${
                      pathname === link.href
                        ? 'text-black bg-gray-100'
                        : 'text-gray-600 hover:text-black hover:bg-gray-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

