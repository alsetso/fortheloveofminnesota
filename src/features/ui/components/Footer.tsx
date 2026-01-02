'use client';

import Link from 'next/link';
import Logo from './Logo';

interface FooterProps {
  fixed?: boolean;
}

export default function Footer({ fixed = false }: FooterProps) {
  const currentYear = new Date().getFullYear();

  const footerClasses = fixed
    ? 'fixed bottom-0 left-0 right-0 z-10 bg-[#2b2b2b] text-gray-300 border-t border-[#3a3a3a]'
    : 'bg-[#2b2b2b] text-gray-300 mt-auto border-t border-[#3a3a3a]';

  return (
    <footer className={footerClasses} role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 lg:gap-6 mb-4">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-2">
              <Logo size="sm" variant="default" />
            </div>
            <p className="text-xs mb-3 max-w-md leading-relaxed text-gray-400">
              For the Love of Minnesota
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-2 text-white">
              Navigation
            </h3>
            <nav aria-label="Main navigation">
              <ul className="space-y-1.5">
                <li>
                  <Link 
                    href="/" 
                    className="text-xs transition-colors text-gray-400 hover:text-white"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/maps" 
                    className="text-xs transition-colors text-gray-400 hover:text-white"
                  >
                    Maps
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/gov" 
                    className="text-xs transition-colors text-gray-400 hover:text-white"
                  >
                    Government
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/contact" 
                    className="text-xs transition-colors text-gray-400 hover:text-white"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          {/* Account & Legal */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-2 text-white">
              Account & Legal
            </h3>
            <nav aria-label="Account and legal navigation">
              <ul className="space-y-1.5">
                <li>
                  <Link 
                    href="/?modal=welcome" 
                    className="text-xs transition-colors text-gray-400 hover:text-white"
                  >
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/account/settings" 
                    className="text-xs transition-colors text-gray-400 hover:text-white"
                  >
                    Settings
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-3 border-t border-[#3a3a3a]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-xs text-center md:text-left text-gray-400">
              © {currentYear} For the Love of Minnesota. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Minnesota, United States</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
