import { redirect } from 'next/navigation';

interface DocsPageProps {
  searchParams: Promise<{ doc?: string }>;
}

/**
 * /docs — redirect to canonical path.
 * /docs?doc=slug → /docs/slug
 * /docs → /docs/getting-started
 */
export default async function DocsPage({ searchParams }: DocsPageProps) {
  const { doc } = await searchParams;
  const slug = doc?.trim() || 'getting-started';
  redirect(`/docs/${encodeURIComponent(slug)}`);
}
