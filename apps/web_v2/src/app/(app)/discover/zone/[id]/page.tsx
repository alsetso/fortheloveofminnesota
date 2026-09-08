import DiscoverZonePage from '@/features/discover/DiscoverZonePage';

/** /discover/zone/[id] — experience zone detail (hero map + collectives). */
export default async function DiscoverZoneRoutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DiscoverZonePage zoneId={decodeURIComponent(id)} />;
}
