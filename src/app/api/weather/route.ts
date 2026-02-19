import { NextRequest, NextResponse } from 'next/server';

const WEATHER_API = 'https://api.weather.gov';
const USER_AGENT = 'LoveOfMinnesota/1.0 (fortheloveofminnesota.com)';

const ALLOWED_PATHS = [
  '/alerts/active',
  '/stations/KMSP/observations/latest',
  '/stations/KDLH/observations/latest',
  '/stations/KRST/observations/latest',
  '/points/',
  '/gridpoints/',
  '/stations',
];

function isAllowedPath(path: string): boolean {
  return ALLOWED_PATHS.some((p) => path.startsWith(p));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  if (!isAllowedPath(path)) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 });
  }

  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'path') params.set(key, value);
  });

  const qs = params.toString();
  const url = `${WEATHER_API}${path}${qs ? `?${qs}` : ''}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Weather API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 502 });
  }
}
