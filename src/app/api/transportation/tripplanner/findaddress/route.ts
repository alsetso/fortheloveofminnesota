import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';

const TRIPPLANNER_BASE = 'https://svc.metrotransit.org/tripplanner';

/**
 * GET /api/transportation/tripplanner/findaddress?magicKey=...&geolocator=...
 * Resolves a suggest result to coordinates via the Metro Transit Trip Planner API.
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async () => {
      const magicKey = request.nextUrl.searchParams.get('magicKey');
      const geolocator = request.nextUrl.searchParams.get('geolocator') ?? '0';

      if (!magicKey) {
        return NextResponse.json({ error: 'magicKey required' }, { status: 400 });
      }

      try {
        const res = await fetch(
          `${TRIPPLANNER_BASE}/findaddress/${encodeURIComponent(magicKey)}/${encodeURIComponent(geolocator)}`,
        );
        if (!res.ok) throw new Error(`findaddress: ${res.status}`);
        const data = await res.json();
        return NextResponse.json(data);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[TripPlanner findaddress]', error);
        }
        return NextResponse.json({ error: 'Failed to resolve address' }, { status: 502 });
      }
    },
    { rateLimit: 'public', requireAuth: false },
  );
}
