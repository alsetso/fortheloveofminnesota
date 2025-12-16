import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-black mb-4">Post Not Found</h1>
        <p className="text-gray-600 mb-8">
          The post you&apos;re looking for doesn&apos;t exist, has been removed, or is not publicly available.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-gold-500 text-black font-semibold rounded-lg hover:bg-gold-600 transition-colors"
        >
          Go to Feed
        </Link>
      </div>
    </div>
  );
}


