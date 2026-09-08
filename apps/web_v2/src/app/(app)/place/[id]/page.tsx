import { redirect } from 'next/navigation';
import { directoryTerritoryPath } from '@/lib/routes/routePolicy';

/**
 * Legacy alias — `/place/:id` redirects to `/directory/territory/:unitId`.
 */
export default async function PlaceRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(directoryTerritoryPath(decodeURIComponent(id).trim()));
}
