import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { DEFAULT_POSE_STATE } from '@/features/avatar/avatarStateTypes';

export const dynamic = 'force-dynamic';

type AvatarModelRow = {
  id: string;
  slug: string;
  name: string;
  file_path: string;
  real_world_meters: number;
};

type AvatarAssetRow = {
  id: string;
  slug: string;
  name: string;
  file_path: string;
  attach_point: string;
  real_world_meters: number | null;
  default_unlock: boolean;
};

type OwnedAssetJoinRow = {
  asset_id: string;
  unlocked_at: string;
  avatar_assets: AvatarAssetRow | AvatarAssetRow[] | null;
};

type AccountRow = {
  avatar_model_id: string | null;
};

/**
 * GET /api/avatar/me
 * Returns the authed account's selected avatar and owned avatar assets.
 * Pose is always the default idle stance — no per-account pose UI.
 *
 * Response:
 *   { avatar_model_id, avatar_url, avatar_slug, avatar_name, pose_state, owned_assets[] }
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createSupabaseServerClient();

    const [accountRes, assetsRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('avatar_model_id')
        .eq('id', session.accountId)
        .maybeSingle(),
      supabase
        .schema('world' as never)
        .from('account_avatar_assets')
        .select('asset_id, unlocked_at, avatar_assets(id, slug, name, file_path, attach_point, real_world_meters, default_unlock)')
        .eq('account_id', session.accountId),
    ]);

    if (accountRes.error) throw accountRes.error;

    const accountData = accountRes.data as AccountRow | null;
    const avatarModelId = accountData?.avatar_model_id ?? null;

    let avatarModel: AvatarModelRow | null = null;
    if (avatarModelId) {
      const modelRes = await supabase
        .schema('world' as never)
        .from('world_models')
        .select('id, slug, name, file_path, real_world_meters')
        .eq('id', avatarModelId)
        .maybeSingle();
      avatarModel = (modelRes.data as AvatarModelRow | null) ?? null;
    }

    const ownedRows = (assetsRes.data ?? []) as unknown as OwnedAssetJoinRow[];

    return NextResponse.json({
      avatar_model_id: avatarModelId,
      avatar_url: avatarModel?.file_path ?? null,
      avatar_slug: avatarModel?.slug ?? null,
      avatar_name: avatarModel?.name ?? null,
      pose_state: DEFAULT_POSE_STATE,
      owned_assets: ownedRows
        .map((r) => {
          const asset = Array.isArray(r.avatar_assets)
            ? r.avatar_assets[0] ?? null
            : r.avatar_assets;
          if (!asset) return null;
          return {
            asset_id: r.asset_id,
            unlocked_at: r.unlocked_at,
            slug: asset.slug,
            name: asset.name,
            file_path: asset.file_path,
            attach_point: asset.attach_point,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null),
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[avatar/me]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
