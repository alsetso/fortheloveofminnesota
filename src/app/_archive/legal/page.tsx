import { Metadata } from 'next';
import Link from 'next/link';
import LegalNav from './components/LegalNav';
import LegalFooter from './components/LegalFooter';

export const metadata: Metadata = {
  title: 'Legal - MNUDA',
  description: 'MNUDA Legal Documents - Terms of Service, Privacy Policy, User Agreement, and Community Guidelines.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function LegalPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <LegalNav />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-4xl font-black text-black mb-8">Legal Documents</h1>
          <p className="text-lg text-gray-700 mb-12 leading-relaxed">
            Please review our legal documents to understand your rights and responsibilities when using MNUDA.
          </p>

          <div className="space-y-6">
            <Link
              href="/legal/terms-of-service"
              className="block p-6 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-600 hover:shadow-md transition-all duration-200"
            >
              <h2 className="text-2xl font-bold text-black mb-2">Terms of Service</h2>
              <p className="text-gray-700 leading-relaxed">
                The terms and conditions governing your use of MNUDA&apos;s services, including our platform, tools, and features.
              </p>
            </Link>

            <Link
              href="/legal/user-agreement"
              className="block p-6 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-600 hover:shadow-md transition-all duration-200"
            >
              <h2 className="text-2xl font-bold text-black mb-2">User Agreement</h2>
              <p className="text-gray-700 leading-relaxed">
                The agreement between you and MNUDA that outlines the rules and guidelines for using our platform and services.
              </p>
            </Link>

            <Link
              href="/legal/privacy-policy"
              className="block p-6 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-600 hover:shadow-md transition-all duration-200"
            >
              <h2 className="text-2xl font-bold text-black mb-2">Privacy Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                How we collect, use, protect, and share your personal information when you use MNUDA&apos;s services.
              </p>
            </Link>

            <Link
              href="/legal/community-guidelines"
              className="block p-6 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-600 hover:shadow-md transition-all duration-200"
            >
              <h2 className="text-2xl font-bold text-black mb-2">Community Guidelines</h2>
              <p className="text-gray-700 leading-relaxed">
                The standards and expectations for behavior within the MNUDA community to ensure a safe and respectful environment.
              </p>
            </Link>
          </div>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

