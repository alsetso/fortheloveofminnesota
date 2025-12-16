import Link from 'next/link';
import AppWrapper from '@/components/app/AppWrapper';

export default function BusinessNotFound() {
  return (
    <AppWrapper>
      <div className="h-full overflow-y-auto bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Page Not Found</h1>
            <p className="text-lg text-gray-600 mb-8">
              The business you&apos;re looking for is not in the directory or may have been removed.
            </p>
            <Link
              href="/business/directory"
              className="inline-flex items-center px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              View All Businesses
            </Link>
          </div>
        </div>
      </div>
    </AppWrapper>
  );
}



