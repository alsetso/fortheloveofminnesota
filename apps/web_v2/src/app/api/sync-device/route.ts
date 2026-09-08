import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createServiceRoleClient } from '@/lib/supabase/server';

type SyncBody = {
  deviceId?: unknown;
  platform?: unknown;
  versionNumber?: unknown;
  bundleNumber?: unknown;
  storeLocation?: unknown;
};

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/**
 * POST /api/sync-device
 * Upsert despia.uuid → auth.users / public.accounts.
 * app_user_id is always accounts.id (session), never client-supplied.
 * Service role writes after session check so a shared phone can reassign device_id.
 */
export async function POST(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: SyncBody;
    try {
      body = (await req.json()) as SyncBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
    if (!deviceId || deviceId.length > 128) {
      return NextResponse.json({ error: 'Missing or invalid deviceId' }, { status: 400 });
    }

    const platform = optionalText(body.platform, 32);
    const versionNumber = optionalText(body.versionNumber, 32);
    const bundleNumber = optionalText(body.bundleNumber, 32);
    const storeLocation = optionalText(body.storeLocation, 64);

    const now = new Date().toISOString();
    const supabase = createServiceRoleClient();

    const { error } = await supabase.from('user_devices').upsert(
      {
        device_id: deviceId,
        user_id: session.userId,
        account_id: session.accountId,
        app_user_id: session.accountId,
        platform,
        version_number: versionNumber,
        bundle_number: bundleNumber,
        store_location: storeLocation,
        last_seen: now,
      },
      { onConflict: 'device_id' },
    );

    if (error) {
      console.error('user_devices upsert', error.message);
      return NextResponse.json({ error: 'Failed to sync device' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deviceId,
      userId: session.userId,
      accountId: session.accountId,
      appUserId: session.accountId,
    });
  } catch (err) {
    console.error('sync-device', err);
    return NextResponse.json({ error: 'Failed to sync device' }, { status: 500 });
  }
}
