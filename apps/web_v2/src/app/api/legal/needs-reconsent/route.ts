import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { getCurrentPolicyVersion, IOS2_LEGAL_PLATFORM } from '@/lib/legal';

export type PolicyUpdateInfo = {
  id: string;
  policy_slug: string;
  policy_title: string;
  version_label: string;
  effective_at: string;
  summary: string;
  changes: {
    id: string;
    change_kind: 'added' | 'updated' | 'removed' | 'clarified';
    section: string | null;
    body: string;
  }[];
};

export type NeedsReconsentResponse =
  | { needs_reconsent: false }
  | { needs_reconsent: true; updates: PolicyUpdateInfo[] };

/**
 * GET /api/legal/needs-reconsent
 * Returns whether the signed-in account is behind the current published policy version.
 * Used to gate the post-login reconsent modal on iOS.
 */
export async function GET() {
  const session = await getSessionAccount();
  if (!session) {
    return NextResponse.json({ needs_reconsent: false });
  }

  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();

  // Fetch the account's currently accepted version IDs
  const { data: account } = await supabase
    .from('accounts')
    .select('terms_version_id, privacy_version_id')
    .eq('id', session.accountId)
    .maybeSingle();

  const [currentTerms, currentPrivacy] = await Promise.all([
    getCurrentPolicyVersion('terms_of_service', IOS2_LEGAL_PLATFORM),
    getCurrentPolicyVersion('privacy_policy', IOS2_LEGAL_PLATFORM),
  ]);

  const stale: { slug: 'terms_of_service' | 'privacy_policy'; accepted: string | null; current: typeof currentTerms }[] = [];

  if (currentTerms && account?.terms_version_id !== currentTerms.id) {
    stale.push({ slug: 'terms_of_service', accepted: account?.terms_version_id ?? null, current: currentTerms });
  }
  if (currentPrivacy && account?.privacy_version_id !== currentPrivacy.id) {
    stale.push({ slug: 'privacy_policy', accepted: account?.privacy_version_id ?? null, current: currentPrivacy });
  }

  if (stale.length === 0) {
    return NextResponse.json<NeedsReconsentResponse>({ needs_reconsent: false });
  }

  // Fetch changelog for each stale version
  const updates: PolicyUpdateInfo[] = await Promise.all(
    stale.map(async ({ slug, current }) => {
      if (!current) return null;
      const { data: changes } = await supabase
        .from('legal_policy_changes')
        .select('id, change_kind, section, body')
        .eq('version_id', current.id)
        .order('sort_order', { ascending: true });

      return {
        id: current.id,
        policy_slug: slug,
        policy_title: slug === 'terms_of_service' ? 'Terms of Service' : 'Privacy Policy',
        version_label: current.version_label,
        effective_at: current.effective_at,
        summary: current.summary,
        changes: (changes ?? []) as PolicyUpdateInfo['changes'],
      } satisfies PolicyUpdateInfo;
    }),
  ).then(r => r.filter(Boolean) as PolicyUpdateInfo[]);

  return NextResponse.json<NeedsReconsentResponse>({ needs_reconsent: true, updates });
}
