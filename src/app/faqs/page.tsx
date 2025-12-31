import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import FAQsClient from '@/features/faqs/components/FAQsClient';
import PageViewTracker from '@/components/analytics/PageViewTracker';

export const metadata: Metadata = {
  title: 'FAQs | For the Love of Minnesota',
  description: 'Frequently asked questions about For the Love of Minnesota, including information about permissions, privacy, and how the platform works.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function FAQsPage() {
  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <PageViewTracker />
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-3" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-xs text-gray-600">
            <li>
              <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">FAQs</li>
          </ol>
        </nav>

        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <h1 className="text-sm font-semibold text-gray-900 mb-3">Frequently Asked Questions</h1>
          
          {/* FAQs rendered by FAQsClient component */}
          <FAQsClient />
        </div>

          {/* Related Sections */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <h2 className="text-xs font-semibold text-gray-900 mb-2">Explore More</h2>
            <div className="flex flex-wrap gap-2">
              <Link href="/explore" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
                Explore Minnesota
              </Link>
              <span className="text-gray-300">•</span>
              <Link href="/explore/cities" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
                Cities Directory
              </Link>
              <span className="text-gray-300">•</span>
              <Link href="/explore/counties" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
                Counties Directory
              </Link>
              <span className="text-gray-300">•</span>
              <Link href="/contact" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </SimplePageLayout>
  );
}


