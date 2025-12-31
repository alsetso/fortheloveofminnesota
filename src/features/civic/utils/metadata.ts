import { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';

export function generateGovMetadata({
  title,
  description,
  url,
  keywords = [],
}: {
  title: string;
  description: string;
  url: string;
  keywords?: string[];
}): Metadata {
  return {
    title: `${title} | For the Love of Minnesota`,
    description,
    keywords: ['Minnesota government', ...keywords],
    openGraph: {
      title: `${title} | For the Love of Minnesota`,
      description,
      url: `${baseUrl}${url}`,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: title,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}${url}`,
    },
  };
}

/**
 * Generate metadata for branch pages (legislative, executive, judicial)
 */
export function generateBranchMetadata(
  branchName: string,
  description: string,
  keywords: string[]
): Metadata {
  const path = `/gov/${branchName.toLowerCase()}`;
  const title = `Minnesota ${branchName} Branch | For the Love of Minnesota`;
  
  return generateGovMetadata({
    title: `Minnesota ${branchName} Branch`,
    description,
    url: path,
    keywords,
  });
}

