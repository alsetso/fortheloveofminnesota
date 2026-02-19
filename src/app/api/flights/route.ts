import { MAP_CONFIG } from '@/features/map/config';

const MN_BOUNDS = {
  lamin: MAP_CONFIG.MINNESOTA_BOUNDS.south,
  lomin: MAP_CONFIG.MINNESOTA_BOUNDS.west,
  lamax: MAP_CONFIG.MINNESOTA_BOUNDS.north,
  lomax: MAP_CONFIG.MINNESOTA_BOUNDS.east,
};

// MN bounding box ≈ 48 sq deg → 2 credits per request.
// Authenticated users: 4000 credits/day → 2000 requests max.
// Budget: reserve 10% headroom → 1800 usable requests.
const CREDITS_PER_REQUEST = 2;
const DAILY_CREDIT_LIMIT = 4000;
const DAILY_REQUEST_BUDGET = Math.floor((DAILY_CREDIT_LIMIT * 0.9) / CREDITS_PER_REQUEST);

const CACHE_TTL_MS = 30_000;

// --- In-process state (survives across requests in the same serverless instance) ---

let cachedResponse: { data: unknown; timestamp: number } | null = null;

let dailyRequestCount = 0;
let dailyResetDate = todayUTC();

let oauthToken: { accessToken: string; expiresAt: number } | null = null;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetDailyCounterIfNeeded() {
  const today = todayUTC();
  if (dailyResetDate !== today) {
    dailyRequestCount = 0;
    dailyResetDate = today;
  }
}

// --- OAuth2 client credentials flow (required for post-March 2025 accounts) ---

async function getAccessToken(): Promise<string> {
  if (oauthToken && Date.now() < oauthToken.expiresAt - 60_000) {
    return oauthToken.accessToken;
  }

  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET not configured');
  }

  const res = await fetch(
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth2 token request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  oauthToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 1800) * 1000,
  };
  return oauthToken.accessToken;
}

// --- Route handler ---

export async function GET() {
  resetDailyCounterIfNeeded();

  const remainingRequests = DAILY_REQUEST_BUDGET - dailyRequestCount;
  const remainingCredits = DAILY_CREDIT_LIMIT - dailyRequestCount * CREDITS_PER_REQUEST;

  // Serve from cache if fresh
  if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL_MS) {
    return Response.json(cachedResponse.data, {
      headers: rateLimitHeaders(remainingCredits, remainingRequests, true),
    });
  }

  // Hard stop: daily budget exhausted
  if (remainingRequests <= 0) {
    return Response.json(
      { error: 'Daily OpenSky credit budget exhausted (4000/day). Resets at midnight UTC.' },
      {
        status: 429,
        headers: rateLimitHeaders(0, 0, false),
      },
    );
  }

  try {
    const token = await getAccessToken();

    const { lamin, lomin, lamax, lomax } = MN_BOUNDS;
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      // If 429 from OpenSky itself, forward it
      if (res.status === 429) {
        const retryAfter = res.headers.get('X-Rate-Limit-Retry-After-Seconds') ?? '60';
        return Response.json(
          { error: 'OpenSky rate limit reached', retryAfterSeconds: Number(retryAfter) },
          { status: 429, headers: { 'Retry-After': retryAfter } },
        );
      }

      // 401 = expired/invalid token — clear it so next request re-authenticates
      if (res.status === 401) {
        oauthToken = null;
      }

      return Response.json(
        { error: `OpenSky returned ${res.status}` },
        { status: res.status },
      );
    }

    dailyRequestCount++;

    const data = await res.json();
    cachedResponse = { data, timestamp: Date.now() };

    return Response.json(data, {
      headers: rateLimitHeaders(remainingCredits - CREDITS_PER_REQUEST, remainingRequests - 1, false),
    });
  } catch (err) {
    console.error('[/api/flights]', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 502 },
    );
  }
}

function rateLimitHeaders(creditsRemaining: number, requestsRemaining: number, cached: boolean) {
  return {
    'X-Credits-Remaining': String(Math.max(0, creditsRemaining)),
    'X-Requests-Remaining': String(Math.max(0, requestsRemaining)),
    'X-Cache-TTL': String(CACHE_TTL_MS / 1000),
    'X-Served-From-Cache': cached ? '1' : '0',
  };
}
