/** Legal policy platforms — keep in sync with docs/legal/LEGAL_POLICIES.md */

export const LEGAL_PLATFORMS = ['all', 'ios2', 'web'] as const;
export type LegalPlatform = (typeof LEGAL_PLATFORMS)[number] | (string & {});

/** Runtime platform for this app. */
export const IOS2_LEGAL_PLATFORM: LegalPlatform = 'ios2';

export const LEGAL_POLICY_SLUGS = ['terms_of_service', 'privacy_policy'] as const;
export type LegalPolicySlug = (typeof LEGAL_POLICY_SLUGS)[number];

export type LegalAcceptanceMethod = 'signup' | 'reconsent' | 'notice';

export type LegalPolicyVersion = {
  id: string;
  policy_id: string;
  platform: string;
  version_label: string;
  version_seq: number;
  status: 'draft' | 'published' | 'superseded';
  effective_at: string;
  published_at: string | null;
  retired_at: string | null;
  title: string;
  summary: string;
  content_md: string;
  created_at: string;
};

export type LegalPolicyChange = {
  id: string;
  version_id: string;
  sort_order: number;
  change_kind: 'added' | 'updated' | 'removed' | 'clarified';
  section: string | null;
  body: string;
};
