import { createServerClient } from '@/lib/supabaseServer';

export interface CivicOrg {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  org_type: 'branch' | 'agency' | 'department' | 'court';
  description: string | null;
  website: string | null;
  created_at: string;
}

export interface CivicPerson {
  id: string;
  name: string;
  slug: string | null;
  party: string | null;
  photo_url: string | null;
  district: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export interface CivicRole {
  id: string;
  person_id: string;
  org_id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
  person?: CivicPerson;
  org?: CivicOrg;
}

export interface OrgWithRoles extends CivicOrg {
  roles?: (CivicRole & { person?: CivicPerson })[];
  children?: OrgWithRoles[];
}

/**
 * Fetch all organizations with their roles and people
 */
export async function getCivicOrgs(): Promise<CivicOrg[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('orgs')
    .select('*')
    .order('name');

  if (error) {
    console.error('[civicService] Error fetching orgs:', error);
    return [];
  }

  return (data || []) as CivicOrg[];
}

/**
 * Fetch all people
 */
export async function getCivicPeople(): Promise<CivicPerson[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .order('name');

  if (error) {
    console.error('[civicService] Error fetching people:', error);
    return [];
  }

  return (data || []) as CivicPerson[];
}

/**
 * Fetch all roles with person and org data
 */
export async function getCivicRoles(): Promise<CivicRole[]> {
  const supabase = createServerClient();
  
  const [rolesResult, peopleResult, orgsResult] = await Promise.all([
    supabase.from('roles').select('*').eq('is_current', true).order('title'),
    supabase.from('people').select('*'),
    supabase.from('orgs').select('*'),
  ]);

  if (rolesResult.error) {
    console.error('[civicService] Error fetching roles:', rolesResult.error);
    return [];
  }

  const roles = (rolesResult.data || []) as any[];
  const people = new Map(((peopleResult.data || []) as CivicPerson[]).map(p => [p.id, p]));
  const orgs = new Map(((orgsResult.data || []) as CivicOrg[]).map(o => [o.id, o]));

  return roles.map(role => ({
    ...role,
    person: people.get(role.person_id) || undefined,
    org: orgs.get(role.org_id) || undefined,
  })) as CivicRole[];
}

/**
 * Build organizational tree from orgs
 */
export async function getCivicOrgTree(): Promise<OrgWithRoles[]> {
  const [orgs, roles] = await Promise.all([
    getCivicOrgs(),
    getCivicRoles(),
  ]);

  // Create a map of org_id to roles
  const rolesByOrgId = new Map<string, (CivicRole & { person?: CivicPerson })[]>();
  roles.forEach(role => {
    if (!rolesByOrgId.has(role.org_id)) {
      rolesByOrgId.set(role.org_id, []);
    }
    rolesByOrgId.get(role.org_id)!.push(role);
  });

  // Create a map of orgs by id
  const orgsById = new Map<string, OrgWithRoles>();
  orgs.forEach(org => {
    orgsById.set(org.id, {
      ...org,
      roles: rolesByOrgId.get(org.id) || [],
      children: [],
    });
  });

  // Build tree structure
  const roots: OrgWithRoles[] = [];
  orgsById.forEach(org => {
    if (org.parent_id && orgsById.has(org.parent_id)) {
      const parent = orgsById.get(org.parent_id)!;
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(org);
    } else {
      roots.push(org);
    }
  });

  // Sort children
  const sortOrgs = (orgs: OrgWithRoles[]) => {
    orgs.sort((a, b) => a.name.localeCompare(b.name));
    orgs.forEach(org => {
      if (org.children) {
        sortOrgs(org.children);
      }
    });
  };

  sortOrgs(roots);
  return roots;
}

/**
 * Get organizations by type
 */
export async function getCivicOrgsByType(type: 'branch' | 'agency' | 'department' | 'court'): Promise<OrgWithRoles[]> {
  const tree = await getCivicOrgTree();
  return tree.filter(org => org.org_type === type);
}

/**
 * Get a single person by slug or ID with all their roles
 */
export async function getCivicPersonBySlug(slug: string): Promise<{ person: CivicPerson; roles: (CivicRole & { org?: CivicOrg })[] } | null> {
  const supabase = createServerClient();
  
  // Check if slug is a UUID (person ID) or a slug
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  
  const { data: person, error: personError } = await supabase
    .from('people')
    .select('*')
    .eq(isUUID ? 'id' : 'slug', slug)
    .single();

  if (personError || !person) {
    return null;
  }

  // Get all roles for this person
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('*')
    .eq('person_id', person.id)
    .eq('is_current', true)
    .order('title');

  if (rolesError) {
    console.error('[civicService] Error fetching roles for person:', rolesError);
  }

  // Get orgs for these roles
  const orgIds = [...new Set((roles || []).map(r => r.org_id))];
  const { data: orgs } = await supabase
    .from('orgs')
    .select('*')
    .in('id', orgIds);

  const orgsMap = new Map((orgs || []).map(o => [o.id, o]));

  return {
    person: person as CivicPerson,
    roles: (roles || []).map(role => ({
      ...role,
      org: orgsMap.get(role.org_id) || undefined,
    })) as (CivicRole & { org?: CivicOrg })[],
  };
}

/**
 * Get a single organization with its roles
 */
export async function getCivicOrgBySlug(slug: string): Promise<OrgWithRoles | null> {
  const supabase = createServerClient();
  
  const { data: org, error: orgError } = await supabase
    .from('orgs')
    .select('*')
    .eq('slug', slug)
    .single();

  if (orgError || !org) {
    return null;
  }

  // Get roles and people for this org
  const [rolesResult, peopleResult, childrenResult] = await Promise.all([
    supabase.from('roles').select('*').eq('org_id', org.id).eq('is_current', true).order('title'),
    supabase.from('people').select('*'),
    supabase.from('orgs').select('*').eq('parent_id', org.id).order('name'),
  ]);

  if (rolesResult.error) {
    console.error('[civicService] Error fetching roles for org:', rolesResult.error);
  }
  if (childrenResult.error) {
    console.error('[civicService] Error fetching child orgs:', childrenResult.error);
  }

  const roles = rolesResult.data || [];
  const people = new Map((peopleResult.data || []).map(p => [p.id, p]));
  const rolesWithPeople = roles.map(role => ({
    ...role,
    person: people.get(role.person_id) || undefined,
  })) as (CivicRole & { person?: CivicPerson })[];

  // Recursively get roles for children
  const childrenWithRoles: OrgWithRoles[] = await Promise.all(
    (childrenResult.data || []).map(async (child) => {
      const { data: childRoles } = await supabase
        .from('roles')
        .select('*')
        .eq('org_id', child.id)
        .eq('is_current', true);

      const childPeople = new Map((peopleResult.data || []).map(p => [p.id, p]));
      return {
        ...child,
        roles: (childRoles || []).map((r: any) => ({
          ...r,
          person: childPeople.get(r.person_id) || undefined,
        })) as (CivicRole & { person?: CivicPerson })[],
        children: [],
      };
    })
  );

  return {
    ...org,
    roles: rolesWithPeople,
    children: childrenWithRoles,
  };
}

