import Link from 'next/link';

export default function ProfileNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Profile Not Found
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          The profile you&apos;re looking for doesn&apos;t exist or may have been removed.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
        >
          Back to Map
        </Link>
      </div>
    </div>
  );
}





