import { createServiceRoleClient } from '@/lib/supabase/server';
import { getBundledPolicyVersion } from '@/lib/legal/bundledPolicies';
import {
  IOS2_LEGAL_PLATFORM,
  type LegalPlatform,
  type LegalPolicyChange,
  type LegalPolicySlug,
  type LegalPolicyVersion,
} from '@/lib/legal/types';

type VersionRow = LegalPolicyVersion;

async function fetchPublishedForPlatform(
  slug: LegalPolicySlug,
  platform: LegalPlatform,
): Promise<VersionRow | null> {
  try {
    const supabase = createServiceRoleClient();

    // Prefer RPC when migration is applied
    const { data: rpcData, error: rpcError } = await supabase.rpc('legal_current_version', {
      p_slug: slug,
      p_platform: platform,
    });

    if (!rpcError && rpcData) {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (row?.id && row?.content_md) return row as VersionRow;
    }

    // Manual resolve: platform override → all
    const { data: policy } = await supabase
      .from('legal_policies')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (!policy?.id) return null;

    const tryPlatform = async (p: string) => {
      const { data } = await supabase
        .from('legal_policy_versions')
        .select(
          'id, policy_id, platform, version_label, version_seq, status, effective_at, published_at, retired_at, title, summary, content_md, created_at',
        )
        .eq('policy_id', policy.id)
        .eq('platform', p)
        .eq('status', 'published')
        .order('version_seq', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as VersionRow | null;
    };

    const specific = await tryPlatform(String(platform));
    if (specific) return specific;
    if (platform !== 'all') return tryPlatform('all');
    return null;
  } catch (err) {
    console.warn('legal_current_version lookup failed; using bundled fallback', err);
    return null;
  }
}

/** Current published policy for a platform (DB first, bundled markdown fallback). */
export async function getCurrentPolicyVersion(
  slug: LegalPolicySlug,
  platform: LegalPlatform = IOS2_LEGAL_PLATFORM,
): Promise<LegalPolicyVersion> {
  const fromDb = await fetchPublishedForPlatform(slug, platform);
  if (fromDb) return fromDb;
  return getBundledPolicyVersion(slug, platform);
}

export async function getPolicyChangelog(versionId: string): Promise<LegalPolicyChange[]> {
  if (versionId.startsWith('bundled:')) return [];
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('legal_policy_changes')
      .select('id, version_id, sort_order, change_kind, section, body')
      .eq('version_id', versionId)
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return data as LegalPolicyChange[];
  } catch {
    return [];
  }
}
