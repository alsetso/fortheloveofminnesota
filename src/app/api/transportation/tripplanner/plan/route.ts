import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';

const TRIPPLANNER_BASE = 'https://svc.metrotransit.org/tripplanner';

/**
 * POST /api/transportation/tripplanner/plan
 * Proxies Metro Transit Trip Planner plantrip endpoint.
 * Body: PlantripInput — { origin, destination, datetime, arrdep, walkdist, minimize, accessible, xmode }
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async () => {
      try {
        const body = await request.json();

        if (!body.origin?.point || !body.destination?.point) {
          return NextResponse.json(
            { error: 'origin and destination with point coordinates required' },
            { status: 400 },
          );
        }

        const res = await fetch(`${TRIPPLANNER_BASE}/plantrip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error(`plantrip: ${res.status}`);
        const data = await res.json();
        return NextResponse.json(data);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[TripPlanner plan]', error);
        }
        return NextResponse.json({ error: 'Failed to plan trip' }, { status: 502 });
      }
    },
    { rateLimit: 'public', requireAuth: false },
  );
}
