import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  acceptCurrentLegalPolicies,
  IOS2_LEGAL_PLATFORM,
  type LegalAcceptanceMethod,
} from '@/lib/legal';

/**
 * POST /api/legal/accept
 * Body: { method?: 'signup' | 'reconsent' | 'notice', platform?: string }
 *
 * signup    — first bind only (idempotent). Will not silently upgrade versions.
 * reconsent — explicit agreement to a newly published version.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let method: LegalAcceptanceMethod = 'signup';
    let platform = IOS2_LEGAL_PLATFORM;
    try {
      const body = (await request.json()) as {
        method?: LegalAcceptanceMethod;
        platform?: string;
      };
      if (body.method === 'signup' || body.method === 'reconsent' || body.method === 'notice') {
        method = body.method;
      }
      if (body.platform && /^[a-z][a-z0-9_]*$/.test(body.platform)) {
        platform = body.platform;
      }
    } catch {
      // empty body ok
    }

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null;
    const userAgent = request.headers.get('user-agent') ?? null;

    const result = await acceptCurrentLegalPolicies({
      accountId: session.accountId,
      platform,
      method,
      ipAddress,
      userAgent,
    });

    if (!result) {
      return NextResponse.json(
        {
          error:
            'Failed to record policy acceptance. Ensure legal_policies migration is applied.',
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('legal accept', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
