import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LegalPlatform, LegalPolicySlug, LegalPolicyVersion } from '@/lib/legal/types';

/**
 * Bundled markdown fallback when DB migration is not applied yet.
 * Authoring source of truth: docs/legal/policies/<slug>/<version>.md
 */
const BUNDLED: Record<
  LegalPolicySlug,
  { version_label: string; title: string; effective_at: string; file: string }
> = {
  terms_of_service: {
    version_label: '2026.04.17',
    title: 'Terms of Service',
    effective_at: '2026-04-17T00:00:00.000Z',
    file: 'terms_of_service/2026.04.17.md',
  },
  privacy_policy: {
    version_label: '2026.04.17',
    title: 'Privacy Policy',
    effective_at: '2026-04-17T00:00:00.000Z',
    file: 'privacy_policy/2026.04.17.md',
  },
};

function stripAuthoringWrapper(raw: string): string {
  const contentMarker = raw.indexOf('\n## Content\n');
  if (contentMarker >= 0) {
    return raw.slice(contentMarker + '\n## Content\n'.length).trim();
  }
  // Drop YAML frontmatter if present
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end >= 0) return raw.slice(end + 4).trim();
  }
  return raw.trim();
}

export async function loadBundledPolicyMarkdown(slug: LegalPolicySlug): Promise<string> {
  const meta = BUNDLED[slug];
  const filePath = path.join(process.cwd(), 'docs/legal/policies', meta.file);
  const raw = await readFile(filePath, 'utf8');
  return stripAuthoringWrapper(raw);
}

export async function getBundledPolicyVersion(
  slug: LegalPolicySlug,
  platform: LegalPlatform = 'all',
): Promise<LegalPolicyVersion> {
  const meta = BUNDLED[slug];
  const content_md = await loadBundledPolicyMarkdown(slug);
  return {
    id: `bundled:${slug}:${meta.version_label}`,
    policy_id: `bundled:${slug}`,
    platform: platform === 'ios2' || platform === 'web' ? 'all' : String(platform),
    version_label: meta.version_label,
    version_seq: 1,
    status: 'published',
    effective_at: meta.effective_at,
    published_at: meta.effective_at,
    retired_at: null,
    title: meta.title,
    summary: `Bundled ${meta.title} ${meta.version_label}`,
    content_md,
    created_at: meta.effective_at,
  };
}
