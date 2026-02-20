import { createCivicServerClient } from '@/lib/supabaseServer';
import type { CivicAgency } from '../services/civicService';

export interface BreadcrumbItem {
  label: string;
  href: string | null;
}

/**
 * Build breadcrumb trail for an organization (branch-scoped URLs).
 * Returns: Home > Government > [Parent Orgs] > [Current Org]
 */
export async function buildOrgBreadcrumbs(org: { id: string; parent_id: string | null; name: string; slug: string; org_type: string }, branch: string): Promise<BreadcrumbItem[]> {
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Government', href: '/gov' },
  ];

  // Build parent chain
  const supabase = await createCivicServerClient();
  const { data: allAgencies } = await supabase
    .from('agencies')
    .select('id, parent_id, name, slug, org_type')
    .order('name');

  if (!allAgencies) {
    breadcrumbs.push({ label: org.name, href: null });
    return breadcrumbs;
  }

  const agenciesMap = new Map(allAgencies.map((o: any) => [o.id, o]));
  const parentChain: Array<{ name: string; slug: string; org_type: string }> = [];

  let current = org.parent_id ? agenciesMap.get(org.parent_id) : null;
  while (current) {
    if (current.org_type !== 'branch' && current.id !== org.id) {
      parentChain.unshift({
        name: current.name,
        slug: current.slug,
        org_type: current.org_type,
      });
    }
    current = current.parent_id ? agenciesMap.get(current.parent_id) : null;
  }

  parentChain.forEach(parent => {
    breadcrumbs.push({
      label: parent.name,
      href: `/gov/${branch}/agency/${parent.slug}`,
    });
  });

  // Add current org (non-clickable)
  breadcrumbs.push({
    label: org.name,
    href: null,
  });

  return breadcrumbs;
}

