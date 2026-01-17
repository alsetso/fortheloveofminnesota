import LiveMap from '@/features/homepage/components/LiveMap';
import SpecialMapViewTracker from '@/components/analytics/SpecialMapViewTracker';

// Configure route segment for optimal caching
export const dynamic = 'force-dynamic'; // Feed content changes frequently

export default async function LivePage() {
  return (
    <>
      <SpecialMapViewTracker mapIdentifier="live" />
      <LiveMap />
    </>
  );
}

