import { notFound } from 'next/navigation';
import { passportKindBySlug } from '@/features/accountTerritories/store/passportKinds';
import DiscoverKindPage from '@/features/discover/DiscoverKindPage';

/**
 * /discover/:kind — visited + left-to-visit passport list for one territory type.
 */
export default async function DiscoverKindRoutePage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!passportKindBySlug(kind)) notFound();
  return <DiscoverKindPage kindSlug={kind} />;
}
