import type { LaunchFormValues, LaunchLocationMode, PageStatus } from '@/lib/directory/launchPageForm';
import type { LaunchPageTypeSlug } from '@/lib/directory/pageTypes';

export type LaunchDirectoryPageInput = {
  pageType: LaunchPageTypeSlug;
  form: LaunchFormValues;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export type LaunchDirectoryPageResult = {
  id: string;
  slug: string;
  claimed: boolean;
  status: PageStatus;
};

export async function launchDirectoryPage(
  input: LaunchDirectoryPageInput,
): Promise<LaunchDirectoryPageResult> {
  const locationMode: LaunchLocationMode = input.form.locationMode ?? 'skip';
  const res = await fetch('/api/directory/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      title: input.form.title.trim(),
      description: input.form.description.trim() || null,
      phone: input.form.phone.trim() || null,
      email: input.form.email.trim() || null,
      website: input.form.website.trim() || null,
      instagram: input.form.instagram.trim() || null,
      page_type: input.pageType,
      category_id: input.form.categoryId,
      home_based: input.form.homeBased,
      status: input.form.status,
      self_claim: input.form.selfClaim,
      location_mode: locationMode,
      address: locationMode === 'building' ? input.address : null,
      lat: locationMode === 'building' ? input.lat : null,
      lng: locationMode === 'building' ? input.lng : null,
    }),
  });
  const json = (await res.json().catch(() => null)) as
    | (LaunchDirectoryPageResult & { error?: string })
    | null;
  if (!res.ok) {
    throw new Error(json?.error ?? 'Failed to create page');
  }
  if (!json?.id || !json.slug) {
    throw new Error('Page created but no id returned');
  }
  return {
    id: json.id,
    slug: json.slug,
    claimed: json.claimed === true,
    status: json.status === 'draft' ? 'draft' : 'active',
  };
}
