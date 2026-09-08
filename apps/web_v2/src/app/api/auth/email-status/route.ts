import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

type LookupRow = {
  user_exists: boolean;
  has_password: boolean;
};

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

/**
 * POST /api/auth/email-status
 * Body: { email: string }
 * Returns: { exists: boolean, hasPassword: boolean }
 *
 * Does not create users. Powers welcome branching (signup vs password vs OTP).
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const email = normalizeEmail(
      body && typeof body === 'object' && 'email' in body
        ? (body as { email?: unknown }).email
        : null,
    );
    if (!email) {
      return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc('lookup_auth_email', {
      p_email: email,
    });

    if (error) {
      console.error('lookup_auth_email', error);
      return NextResponse.json({ error: 'Could not check email.' }, { status: 503 });
    }

    const row = (Array.isArray(data) ? data[0] : data) as LookupRow | null;
    return NextResponse.json({
      exists: Boolean(row?.user_exists),
      hasPassword: Boolean(row?.has_password),
    });
  } catch (err) {
    console.error('email-status', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
