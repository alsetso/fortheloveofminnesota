import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';

const TRIPPLANNER_BASE = 'https://svc.metrotransit.org/tripplanner';

/**
 * GET /api/transportation/tripplanner/suggest?text=...&location=...
 * Proxies Metro Transit Trip Planner suggest endpoint for location autocomplete.
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async () => {
      const text = request.nextUrl.searchParams.get('text');
      const location = request.nextUrl.searchParams.get('location') ?? '';

      if (!text || text.trim().length < 2) {
        return NextResponse.json({ suggestions: [] });
      }

      try {
        const res = await fetch(
          `${TRIPPLANNER_BASE}/suggest/${encodeURIComponent(text.trim())}/${encodeURIComponent(location)}`,
        );
        if (!res.ok) throw new Error(`suggest: ${res.status}`);
        const suggestions = await res.json();
        return NextResponse.json({ suggestions });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[TripPlanner suggest]', error);
        }
        return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 502 });
      }
    },
    { rateLimit: 'public', requireAuth: false },
  );
}
