import { createServerClient } from '@/lib/supabaseServer';
import type { CivicOrg } from '../services/civicService';

export interface BreadcrumbItem {
  label: string;
  href: string | null;
}

/**
 * Build breadcrumb trail for an organization
 * Returns: Home > Government > [Parent Orgs] > [Current Org]
 */
export async function buildOrgBreadcrumbs(org: { id: string; parent_id: string | null; name: string; slug: string; org_type: string }): Promise<BreadcrumbItem[]> {
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Government', href: '/gov' },
  ];

  // Build parent chain
  const supabase = createServerClient();
  const { data: allOrgs } = await supabase
    .from('orgs')
    .select('id, parent_id, name, slug, org_type')
    .order('name');

  if (!allOrgs) {
    breadcrumbs.push({ label: org.name, href: null });
    return breadcrumbs;
  }

  const orgsMap = new Map(allOrgs.map((o: any) => [o.id, o]));
  const parentChain: Array<{ name: string; slug: string; org_type: string }> = [];

  // Build parent chain (excluding the org itself and branches)
  let current = org.parent_id ? orgsMap.get(org.parent_id) : null;
  while (current) {
    if (current.org_type !== 'branch' && current.id !== org.id) {
      parentChain.unshift({
        name: current.name,
        slug: current.slug,
        org_type: current.org_type,
      });
    }
    current = current.parent_id ? orgsMap.get(current.parent_id) : null;
  }

  // Add parent chain
  parentChain.forEach(parent => {
    breadcrumbs.push({
      label: parent.name,
      href: `/gov/org/${parent.slug}`,
    });
  });

  // Add current org (non-clickable)
  breadcrumbs.push({
    label: org.name,
    href: null,
  });

  return breadcrumbs;
}

