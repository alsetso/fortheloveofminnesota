import { NextResponse } from 'next/server';
import {
  getCurrentPolicyVersion,
  IOS2_LEGAL_PLATFORM,
  LEGAL_POLICY_SLUGS,
  type LegalPolicySlug,
} from '@/lib/legal';

/**
 * GET /api/legal/current?slug=terms_of_service|privacy_policy&platform=ios2
 * Returns the current published version for the platform (falls back to `all`).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get('slug') ?? '') as LegalPolicySlug;
  const platform = searchParams.get('platform') ?? IOS2_LEGAL_PLATFORM;

  if (!LEGAL_POLICY_SLUGS.includes(slug)) {
    return NextResponse.json(
      { error: 'slug must be terms_of_service or privacy_policy' },
      { status: 400 },
    );
  }

  const version = await getCurrentPolicyVersion(slug, platform);
  return NextResponse.json({
    slug,
    platform,
    resolved_platform: version.platform,
    version: {
      id: version.id,
      version_label: version.version_label,
      version_seq: version.version_seq,
      effective_at: version.effective_at,
      published_at: version.published_at,
      title: version.title,
      summary: version.summary,
      content_md: version.content_md,
    },
  });
}
