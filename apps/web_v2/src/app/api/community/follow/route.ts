import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type FollowBody = {
  target_account_id?: string;
  /** When true on DELETE: remove inbound follower edge (them → me). */
  remove_follower?: boolean;
};

async function readBody(req: Request): Promise<FollowBody> {
  try {
    return (await req.json()) as FollowBody;
  } catch {
    return {};
  }
}

/**
 * POST /api/community/follow — follow an account (idempotent upsert).
 * DELETE /api/community/follow — unfollow (default) or remove a follower
 * (`remove_follower: true`). Body: `{ target_account_id, remove_follower? }`.
 */
export async function POST(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const targetId = (await readBody(req)).target_account_id?.trim() || null;
    if (!targetId) {
      return NextResponse.json({ error: 'Missing target_account_id' }, { status: 400 });
    }
    if (targetId === session.accountId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .schema('community')
      .from('connections')
      .upsert(
        {
          from_account_id: session.accountId,
          to_account_id: targetId,
          relationship: 'follow',
          status: 'accepted',
        },
        { onConflict: 'from_account_id,to_account_id,relationship', ignoreDuplicates: true },
      );

    if (error) {
      console.error('[community/follow POST]', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ following: true });
  } catch (e) {
    console.error('[community/follow POST]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = await readBody(req);
    const targetId = body.target_account_id?.trim() || null;
    if (!targetId) {
      return NextResponse.json({ error: 'Missing target_account_id' }, { status: 400 });
    }
    if (targetId === session.accountId) {
      return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
    }

    const removeFollower = body.remove_follower === true;
    const supabase = await createSupabaseServerClient();
    // Unfollow: me → them. Remove follower: them → me.
    const { error } = await supabase
      .schema('community')
      .from('connections')
      .delete()
      .eq('from_account_id', removeFollower ? targetId : session.accountId)
      .eq('to_account_id', removeFollower ? session.accountId : targetId)
      .eq('relationship', 'follow');

    if (error) {
      console.error('[community/follow DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      removeFollower ? { removed_follower: true } : { following: false },
    );
  } catch (e) {
    console.error('[community/follow DELETE]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
