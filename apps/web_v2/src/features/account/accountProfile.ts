import { createClient } from '@/lib/supabase/client';
import type { AccountRow } from '@/features/auth';
import { MAX_ACCOUNT_TRAITS } from '@/features/account/accountTraits';
import { isReservedUsername } from '@/lib/account/reservedUsernames';

export const ACCOUNT_PROFILE_SELECT =
  'id, user_id, username, first_name, last_name, email, phone, image_url, bio, traits, city_id, county_id, onboarded, status, plan, search_visibility, account_taggable, hide_followers, hide_following, hide_level, hide_streak, hide_discovers, profile_name_display, state_verified, state_verification_checked_at, role';

export type ProfileNameDisplay = 'full_name' | 'username';

export type AccountProfilePatch = {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  bio?: string | null;
  image_url?: string | null;
  email?: string | null;
  phone?: string | null;
  cover_image_url?: string | null;
  traits?: string[] | null;
  owns_business?: boolean | null;
  business_name?: string | null;
  account_type?: 'resident' | 'business' | 'government' | null;
  search_visibility?: boolean;
  account_taggable?: boolean;
  hide_followers?: boolean;
  hide_following?: boolean;
  hide_level?: boolean;
  hide_streak?: boolean;
  hide_discovers?: boolean;
  profile_name_display?: ProfileNameDisplay;
  state_verified?: boolean | null;
  state_verification_checked_at?: string | null;
};

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,30}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, '').replace(/\s+/g, '_');
}

export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (!u) return 'Username is required.';
  if (!USERNAME_RE.test(u)) {
    return 'Use 3–30 letters, numbers, underscores, or hyphens.';
  }
  if (isReservedUsername(u)) {
    return 'That username is reserved.';
  }
  return null;
}

/** Random handle for setup — checked for uniqueness by the caller. */
export function generateRandomUsername(prefix = 'mn'): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const base = `${prefix}_${suffix}`.slice(0, 30);
  return normalizeUsername(base);
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const res = await fetch('/api/accounts/username/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: normalizeUsername(username) }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { available?: boolean };
  return data.available === true;
}

/** Update own public.accounts row; returns the refreshed row. */
export async function updateAccountProfile(
  accountId: string,
  patch: AccountProfilePatch,
): Promise<AccountRow> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const cleaned: AccountProfilePatch = {};
  (Object.keys(patch) as (keyof AccountProfilePatch)[]).forEach((key) => {
    const value = patch[key];
    if (value !== undefined) {
      (cleaned as Record<string, unknown>)[key] = value;
    }
  });

  if (cleaned.username !== undefined && cleaned.username !== null) {
    const err = validateUsername(cleaned.username);
    if (err) throw new Error(err);
    cleaned.username = normalizeUsername(cleaned.username);
  }

  if (cleaned.phone !== undefined && cleaned.phone !== null) {
    cleaned.phone = cleaned.phone.trim() || null;
  }

  if (cleaned.traits !== undefined && cleaned.traits !== null) {
    cleaned.traits = cleaned.traits.slice(0, MAX_ACCOUNT_TRAITS);
  }

  const { data, error } = await supabase
    .from('accounts')
    .update(cleaned)
    .eq('id', accountId)
    .eq('user_id', user.id)
    .select(ACCOUNT_PROFILE_SELECT)
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('That username is already taken.');
    throw new Error(error.message || 'Could not save profile.');
  }
  return data as AccountRow;
}

/** Upload profile image to storage, then patch accounts.image_url. */
export async function uploadAccountImage(accountId: string, file: File): Promise<AccountRow> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5MB.');

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${user.id}/accounts/image_url/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('profile-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(path);
  if (!urlData?.publicUrl) throw new Error('Could not get image URL.');

  return updateAccountProfile(accountId, { image_url: urlData.publicUrl });
}
