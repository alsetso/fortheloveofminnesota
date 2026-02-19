import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';

const NEXTRIP_BASE = 'https://svc.metrotransit.org/nextrip';

interface NexTripAgency {
  agency_id: number;
  agency_name: string;
}

interface NexTripRoute {
  route_id: string;
  agency_id: number;
  route_label: string;
}

/**
 * GET /api/transportation/nextrip
 * Proxies Metro Transit NexTrip API — returns agencies and routes in one call.
 * Optional query params: ?type=agencies | ?type=routes | (default: both)
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async () => {
      const type = request.nextUrl.searchParams.get('type');

      try {
        if (type === 'agencies') {
          const res = await fetch(`${NEXTRIP_BASE}/agencies`, { next: { revalidate: 3600 } });
          if (!res.ok) throw new Error(`NexTrip agencies: ${res.status}`);
          const agencies: NexTripAgency[] = await res.json();
          return NextResponse.json({ agencies });
        }

        if (type === 'routes') {
          const res = await fetch(`${NEXTRIP_BASE}/routes`, { next: { revalidate: 3600 } });
          if (!res.ok) throw new Error(`NexTrip routes: ${res.status}`);
          const routes: NexTripRoute[] = await res.json();
          return NextResponse.json({ routes });
        }

        const [agenciesRes, routesRes] = await Promise.all([
          fetch(`${NEXTRIP_BASE}/agencies`, { next: { revalidate: 3600 } }),
          fetch(`${NEXTRIP_BASE}/routes`, { next: { revalidate: 3600 } }),
        ]);

        if (!agenciesRes.ok) throw new Error(`NexTrip agencies: ${agenciesRes.status}`);
        if (!routesRes.ok) throw new Error(`NexTrip routes: ${routesRes.status}`);

        const agencies: NexTripAgency[] = await agenciesRes.json();
        const routes: NexTripRoute[] = await routesRes.json();

        return NextResponse.json({ agencies, routes });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[NexTrip API] Error:', error);
        }
        return NextResponse.json(
          { error: 'Failed to fetch NexTrip data' },
          { status: 502 },
        );
      }
    },
    {
      rateLimit: 'public',
      requireAuth: false,
    },
  );
}
