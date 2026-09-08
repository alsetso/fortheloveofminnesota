import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { DEFAULT_POSE_STATE } from '@/features/avatar/avatarStateTypes';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/avatar/select
 * Sets accounts.avatar_model_id and resets pose to the default idle stance.
 *
 * Body: { avatar_model_id: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: { avatar_model_id?: string };
    try {
      body = (await request.json()) as { avatar_model_id?: string };
    } catch {
      return NextResponse.json({ error: 'Expected JSON body' }, { status: 400 });
    }

    const modelId = body.avatar_model_id;
    if (!modelId || typeof modelId !== 'string') {
      return NextResponse.json({ error: 'avatar_model_id is required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const { data: model, error: modelErr } = await supabase
      .schema('world' as never)
      .from('world_models')
      .select('id, slug, name, file_path')
      .eq('id', modelId)
      .eq('category', 'avatar')
      .eq('active', true)
      .maybeSingle();

    if (modelErr) throw modelErr;
    if (!model) {
      return NextResponse.json({ error: 'Avatar not found or not available' }, { status: 404 });
    }

    const { error: updateErr } = await supabase
      .from('accounts')
      .update({ avatar_model_id: modelId, pose_state: DEFAULT_POSE_STATE })
      .eq('id', session.accountId);

    if (updateErr) throw updateErr;

    const m = model as { id: string; slug: string; name: string; file_path: string };
    return NextResponse.json({
      avatar_model_id: m.id,
      avatar_url: m.file_path,
      avatar_slug: m.slug,
      avatar_name: m.name,
      pose_state: DEFAULT_POSE_STATE,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[avatar/select]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
