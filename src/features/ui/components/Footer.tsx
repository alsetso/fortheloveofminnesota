'use client';

import Link from 'next/link';
import Logo from './Logo';

interface FooterProps {
  fixed?: boolean;
  variant?: 'light' | 'dark';
}

export default function Footer({ fixed = false, variant = 'light' }: FooterProps) {
  const currentYear = new Date().getFullYear();

  const isDark = variant === 'dark';
  const footerClasses = fixed
    ? `fixed bottom-0 left-0 right-0 z-10 ${isDark ? 'bg-[#2b2b2b] text-gray-300 border-t border-[#3a3a3a]' : 'bg-[#f4f2ef] text-gray-700 border-t border-gray-200'}`
    : `${isDark ? 'bg-[#2b2b2b] text-gray-300 mt-auto border-t border-[#3a3a3a]' : 'bg-[#f4f2ef] text-gray-700 mt-auto border-t border-gray-200'}`;

  return (
    <footer className={footerClasses} role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 lg:gap-6 mb-4">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-2">
              <Logo size="sm" variant="default" />
            </div>
            <p className={`text-xs mb-3 max-w-md leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              For the Love of Minnesota
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Navigation
            </h3>
            <nav aria-label="Main navigation">
              <ul className="space-y-1.5">
                <li>
                  <Link 
                    href="/" 
                    className={`text-xs transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/map" 
                    className={`text-xs transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Map
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/explore" 
                    className={`text-xs transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Explore
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/news" 
                    className={`text-xs transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    News
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/faqs" 
                    className={`text-xs transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    FAQs
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/contact" 
                    className={`text-xs transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          {/* Account & Legal */}
          <div>
            <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Account & Legal
            </h3>
            <nav aria-label="Account and legal navigation">
              <ul className="space-y-1.5">
                <li>
                  <Link 
                    href="/?modal=welcome" 
                    className={`text-xs transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/account/settings" 
                    className={`text-xs transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Settings
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={`pt-3 border-t ${isDark ? 'border-[#3a3a3a]' : 'border-gray-200'}`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <p className={`text-xs text-center md:text-left ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              © {currentYear} For the Love of Minnesota. All rights reserved.
            </p>
            <div className={`flex items-center gap-4 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              <span>Minnesota, United States</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
