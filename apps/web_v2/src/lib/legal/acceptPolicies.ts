import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  IOS2_LEGAL_PLATFORM,
  type LegalAcceptanceMethod,
  type LegalPlatform,
} from '@/lib/legal/types';

export type AcceptLegalResult = {
  account_id: string;
  platform: string;
  method: string;
  accepted_at: string;
  terms_version_id: string;
  privacy_version_id: string;
  terms_version_label: string;
  privacy_version_label: string;
  terms_platform: string;
  privacy_platform: string;
};

/**
 * Bind the account to the current published Terms + Privacy for a platform.
 * Uses security-definer RPC (service role). Idempotent per version id.
 */
export async function acceptCurrentLegalPolicies(params: {
  accountId: string;
  platform?: LegalPlatform;
  method?: LegalAcceptanceMethod;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<AcceptLegalResult | null> {
  const platform = params.platform ?? IOS2_LEGAL_PLATFORM;
  const method = params.method ?? 'signup';

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc('accept_current_legal_policies', {
      p_account_id: params.accountId,
      p_platform: platform,
      p_method: method,
      p_ip_address: params.ipAddress ?? null,
      p_user_agent: params.userAgent ?? null,
    });

    if (error) {
      console.error('accept_current_legal_policies', error.message);
      return null;
    }
    return data as AcceptLegalResult;
  } catch (err) {
    console.error('accept_current_legal_policies', err);
    return null;
  }
}
