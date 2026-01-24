'use client';

import Link from 'next/link';

export type MultiImage = {
  url: string;
  alt?: string | null;
};

export function MultiImageGrid({
  images,
  postHref,
  className = '',
}: {
  images: MultiImage[];
  postHref: string;
  className?: string;
}) {
  if (images.length === 0) return null;

  // Single image: constrain height/whitespace via fixed aspect + cover.
  if (images.length === 1) {
    const image = images[0];
    return (
      <Link
        href={postHref}
        className={`block relative w-full aspect-[4/3] rounded-md overflow-hidden border border-gray-200 bg-gray-100 ${className}`}
        aria-label="View post photos"
        title="View post"
      >
        <img src={image.url} alt={image.alt || 'Post image'} className="w-full h-full object-cover" />
      </Link>
    );
  }

  // Multi image: 2x2 grid; if >4, the 4th tile becomes "+N more".
  const showMore = images.length > 4;
  const remainingCount = showMore ? images.length - 3 : 0;
  const tiles = showMore ? images.slice(0, 3) : images.slice(0, 4);

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {tiles.map((image, index) => (
        <Link
          key={`${image.url}-${index}`}
          href={postHref}
          className="relative w-full aspect-square rounded-md overflow-hidden border border-gray-200 bg-gray-100 hover:bg-gray-50 transition-colors"
          aria-label="View post photos"
          title="View post"
        >
          <img src={image.url} alt={image.alt || `Post image ${index + 1}`} className="w-full h-full object-cover" />
        </Link>
      ))}

      {showMore && (
        <Link
          href={postHref}
          className="relative w-full aspect-square rounded-md overflow-hidden border border-gray-200 bg-gray-100 hover:bg-gray-50 transition-colors"
          aria-label={`View ${remainingCount} more photos`}
          title="View post"
        >
          <img src={images[3].url} alt={images[3].alt || 'More photos'} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gray-900/60 flex items-center justify-center">
            <div className="text-xs font-medium text-white">+{remainingCount} more</div>
          </div>
        </Link>
      )}
    </div>
  );
}

