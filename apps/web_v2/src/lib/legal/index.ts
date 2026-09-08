export type {
  LegalAcceptanceMethod,
  LegalPlatform,
  LegalPolicyChange,
  LegalPolicySlug,
  LegalPolicyVersion,
} from '@/lib/legal/types';
export { IOS2_LEGAL_PLATFORM, LEGAL_PLATFORMS, LEGAL_POLICY_SLUGS } from '@/lib/legal/types';
export { getCurrentPolicyVersion, getPolicyChangelog } from '@/lib/legal/getCurrentPolicy';
export { acceptCurrentLegalPolicies } from '@/lib/legal/acceptPolicies';
