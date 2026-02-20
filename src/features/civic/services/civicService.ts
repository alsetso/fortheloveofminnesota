import { createCivicServerClient, createServerClient, createSupabaseClient } from '@/lib/supabaseServer';

export interface CivicOrg {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  org_type: 'branch' | 'agency' | 'department' | 'court';
  gov_type: string | null;
  branch: string | null;
  description: string | null;
  website: string | null;
  building_id: string | null;
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
  building_id: string | null;
  title: string | null;
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
  const supabase = await createCivicServerClient();
  
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
  const supabase = await createCivicServerClient();
  
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
  const supabase = await createCivicServerClient();
  
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
 * Get a single person by slug or ID with all their roles and building
 */
export async function getCivicPersonBySlug(slug: string): Promise<{
  person: CivicPerson;
  roles: (CivicRole & { org?: CivicOrg })[];
  building: CivicBuilding | null;
} | null> {
  const supabase = await createCivicServerClient();
  
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

  const typedPerson = person as CivicPerson;

  // Fetch roles and building in parallel
  const [rolesResult, buildingResult] = await Promise.all([
    supabase
      .from('roles')
      .select('*')
      .eq('person_id', typedPerson.id)
      .eq('is_current', true)
      .order('title'),
    typedPerson.building_id
      ? supabase.from('buildings').select('*').eq('id', typedPerson.building_id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (rolesResult.error) {
    console.error('[civicService] Error fetching roles for person:', rolesResult.error);
  }

  // Get orgs for these roles
  const typedRoles = (rolesResult.data || []) as CivicRole[];
  const orgIds = [...new Set(typedRoles.map(r => r.org_id))];
  const { data: orgs } = orgIds.length
    ? await supabase.from('orgs').select('*').in('id', orgIds)
    : { data: [] };

  const orgsMap = new Map(((orgs || []) as CivicOrg[]).map(o => [o.id, o]));

  return {
    person: typedPerson,
    roles: typedRoles.map(role => ({
      ...role,
      org: orgsMap.get(role.org_id) || undefined,
    })) as (CivicRole & { org?: CivicOrg })[],
    building: (buildingResult.data as CivicBuilding | null) ?? null,
  };
}

/**
 * Get a single org with building and parent org info
 */
export async function getCivicOrgWithBuilding(slug: string): Promise<(CivicOrg & {
  gov_type?: string | null;
  branch?: string | null;
  building: CivicBuilding | null;
  parent: CivicOrg | null;
}) | null> {
  const supabase = await createCivicServerClient();

  const { data: org, error } = await supabase
    .from('orgs')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !org) return null;

  const typedOrg = org as CivicOrg & { gov_type?: string | null; branch?: string | null; building_id?: string | null; parent_id?: string | null };

  const [buildingResult, parentResult] = await Promise.all([
    typedOrg.building_id
      ? supabase.from('buildings').select('*').eq('id', typedOrg.building_id).single()
      : Promise.resolve({ data: null }),
    typedOrg.parent_id
      ? supabase.from('orgs').select('*').eq('id', typedOrg.parent_id).single()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...typedOrg,
    building: (buildingResult.data as CivicBuilding | null) ?? null,
    parent: (parentResult.data as CivicOrg | null) ?? null,
  };
}

/**
 * Fetch people by building_id
 */
export async function getCivicPeopleByBuildingId(buildingId: string): Promise<CivicPerson[]> {
  const supabase = await createCivicServerClient();
  
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('building_id', buildingId)
    .order('name');

  if (error) {
    console.error('[civicService] Error fetching people by building_id:', error);
    return [];
  }

  return (data || []) as CivicPerson[];
}

export interface CivicBuilding {
  id: string;
  slug: string | null;
  type: string | null;
  name: string | null;
  description: string | null;
  full_address: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  cover_images: string[] | null;
  created_at: string;
  updated_at: string | null;
}

export interface LegislativeMember {
  person_id: string;
  name: string;
  slug: string | null;
  party: string | null;
  photo_url: string | null;
  district: string | null;
  email: string | null;
  phone: string | null;
  role_title: string;
}

/**
 * Get members of a legislative chamber by org slug (mn-senate | mn-house)
 */
export async function getLegislativeMembers(orgSlug: string): Promise<LegislativeMember[]> {
  const supabase = await createCivicServerClient();

  const { data: org } = await supabase
    .from('orgs')
    .select('id')
    .eq('slug', orgSlug)
    .single();

  if (!org) return [];

  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('person_id, title')
    .eq('org_id', (org as any).id)
    .eq('is_current', true);

  if (rolesError || !roles?.length) return [];

  const personIds = roles.map((r: any) => r.person_id);
  const { data: people } = await supabase
    .from('people')
    .select('id, name, slug, party, photo_url, district, email, phone')
    .in('id', personIds);

  if (!people) return [];

  const rolesMap = new Map(roles.map((r: any) => [r.person_id, r.title]));

  return (people as any[])
    .map((p) => ({
      person_id: p.id,
      name: p.name,
      slug: p.slug,
      party: p.party,
      photo_url: p.photo_url,
      district: p.district,
      email: p.email,
      phone: p.phone,
      role_title: rolesMap.get(p.id) ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get the 5 constitutional executive officers with their person data
 */
export async function getExecutiveOfficers(): Promise<{
  person: CivicPerson;
  role: CivicRole;
  org: CivicOrg & { gov_type?: string | null };
}[]> {
  const supabase = await createCivicServerClient();

  const slugOrder = ['governor', 'lieutenant-governor', 'attorney-general', 'secretary-of-state', 'state-auditor'];

  const { data: orgs } = await supabase
    .from('orgs')
    .select('*')
    .eq('branch', 'executive')
    .eq('gov_type', 'elected_office');

  if (!orgs?.length) return [];

  const orgIds = orgs.map((o: any) => o.id);

  const { data: roles } = await supabase
    .from('roles')
    .select('*')
    .in('org_id', orgIds)
    .eq('is_current', true);

  if (!roles?.length) return [];

  const personIds = roles.map((r: any) => r.person_id);
  const { data: people } = await supabase
    .from('people')
    .select('*')
    .in('id', personIds);

  if (!people?.length) return [];

  const peopleMap = new Map((people as CivicPerson[]).map(p => [p.id, p]));
  const orgsMap = new Map((orgs as any[]).map(o => [o.id, o]));

  const results = (roles as CivicRole[]).map(role => ({
    person: peopleMap.get(role.person_id)!,
    role,
    org: orgsMap.get(role.org_id)!,
  })).filter(r => r.person && r.org);

  results.sort((a, b) => {
    const ai = slugOrder.indexOf(a.org.slug);
    const bi = slugOrder.indexOf(b.org.slug);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return results;
}

/**
 * Get departments and agencies under the Governor
 */
export async function getGovernorSubOrgs(): Promise<{
  departments: (CivicOrg & { gov_type?: string | null })[];
  agencies: (CivicOrg & { gov_type?: string | null })[];
  boards: (CivicOrg & { gov_type?: string | null })[];
}> {
  const supabase = await createCivicServerClient();

  const { data: govOrg } = await supabase
    .from('orgs')
    .select('id')
    .eq('slug', 'governor')
    .single();

  if (!govOrg) return { departments: [], agencies: [], boards: [] };

  const { data: children } = await supabase
    .from('orgs')
    .select('*')
    .eq('parent_id', (govOrg as any).id)
    .order('name');

  if (!children) return { departments: [], agencies: [], boards: [] };

  const typed = children as (CivicOrg & { gov_type?: string | null })[];

  return {
    departments: typed.filter(o => o.gov_type === 'department'),
    agencies: typed.filter(o => o.gov_type === 'agency'),
    boards: typed.filter(o => o.gov_type === 'board_commission_council'),
  };
}

export interface JudicialLeader {
  name: string;
  slug: string | null;
  photo_url: string | null;
  title: string;
  court: string;
  court_slug: string;
}

export interface JudicialDistrict {
  district_number: number;
  name: string;
  slug: string;
  description: string | null;
}

/**
 * Get judicial branch data: court orgs, leadership, and districts
 */
export async function getJudicialData(): Promise<{
  courts: (CivicOrg & { gov_type?: string | null })[];
  leaders: JudicialLeader[];
  districts: JudicialDistrict[];
}> {
  const supabase = await createCivicServerClient();
  // layers schema client for jurisdictions (different schema from civic)
  const layersClient = await createServerClient();

  const [courtsResult, rolesResult, districtsResult] = await Promise.all([
    supabase
      .from('orgs')
      .select('*')
      .eq('branch', 'judicial')
      .eq('org_type', 'court')
      .order('name'),
    supabase
      .from('roles')
      .select('title, person_id, org_id')
      .eq('is_current', true),
    (layersClient as any)
      .schema('layers')
      .from('jurisdictions')
      .select('district_number, name, slug, description')
      .eq('jurisdiction_type', 'judicial')
      .order('district_number'),
  ]);

  const courts = (courtsResult.data ?? []) as (CivicOrg & { gov_type?: string | null })[];

  // Build judicial court id set
  const courtIds = new Set(courts.map(c => c.id));
  const judicialRoles = (rolesResult.data ?? []).filter((r: any) => courtIds.has(r.org_id));

  let leaders: JudicialLeader[] = [];
  if (judicialRoles.length > 0) {
    const personIds = judicialRoles.map((r: any) => r.person_id);
    const { data: people } = await supabase
      .from('people')
      .select('id, name, slug, photo_url')
      .in('id', personIds);

    const peopleMap = new Map(((people ?? []) as any[]).map(p => [p.id, p]));
    const courtsMap = new Map(courts.map(c => [c.id, c]));

    leaders = judicialRoles
      .map((r: any) => {
        const person = peopleMap.get(r.person_id);
        const court = courtsMap.get(r.org_id);
        if (!person || !court) return null;
        return {
          name: person.name,
          slug: person.slug,
          photo_url: person.photo_url,
          title: r.title,
          court: court.name,
          court_slug: court.slug,
        } as JudicialLeader;
      })
      .filter(Boolean) as JudicialLeader[];

    // Sort: Supreme Court first, Court of Appeals second; within court: Chief before Associate, then alpha
    leaders.sort((a, b) => {
      const courtOrder = (slug: string) =>
        slug === 'mn-supreme-court' ? 1 : slug === 'mn-court-appeals' ? 2 : 3;
      const titleOrder = (t: string) =>
        t === 'Chief Justice' ? 1 : t === 'Chief Judge' ? 2 : 3;
      const co = courtOrder(a.court_slug) - courtOrder(b.court_slug);
      if (co !== 0) return co;
      const to = titleOrder(a.title) - titleOrder(b.title);
      if (to !== 0) return to;
      return a.name.localeCompare(b.name);
    });
  }

  const districts = (districtsResult.data ?? []) as JudicialDistrict[];

  return { courts, leaders, districts };
}

/**
 * Get organizations for a branch (executive | legislative | judicial)
 */
export async function getBranchOrgs(
  branch: 'executive' | 'legislative' | 'judicial'
): Promise<(CivicOrg & { gov_type?: string | null })[]> {
  const supabase = await createCivicServerClient();
  const { data, error } = await supabase
    .from('orgs')
    .select('*')
    .eq('branch', branch)
    .order('name');
  if (error) return [];
  return (data ?? []) as (CivicOrg & { gov_type?: string | null })[];
}

/**
 * Get a single building by id, with linked people, orgs, and roles
 */
export async function getCivicBuildingById(id: string): Promise<{
  building: CivicBuilding;
  people: CivicPerson[];
  orgs: CivicOrg[];
} | null> {
  const supabase = await createCivicServerClient();

  const [buildingResult, peopleResult, orgsResult] = await Promise.all([
    supabase.from('buildings').select('*').eq('id', id).single(),
    supabase.from('people').select('*').eq('building_id', id).order('name'),
    supabase.from('orgs').select('*').eq('building_id', id).order('name'),
  ]);

  if (buildingResult.error || !(buildingResult as any).data) return null;

  return {
    building: (buildingResult as any).data as CivicBuilding,
    people: ((peopleResult as any).data ?? []) as CivicPerson[],
    orgs: ((orgsResult as any).data ?? []) as CivicOrg[],
  };
}

/**
 * Get a single organization with its roles
 */
export async function getCivicOrgBySlug(slug: string): Promise<OrgWithRoles | null> {
  const supabase = await createCivicServerClient();
  
  const { data: org, error: orgError } = await supabase
    .from('orgs')
    .select('*')
    .eq('slug', slug)
    .single();

  if (orgError || !org) {
    return null;
  }

  const typedOrg = org as CivicOrg;

  // Get roles and people for this org
  const [rolesResult, peopleResult, childrenResult] = await Promise.all([
    supabase.from('roles').select('*').eq('org_id', typedOrg.id).eq('is_current', true).order('title'),
    supabase.from('people').select('*'),
    supabase.from('orgs').select('*').eq('parent_id', typedOrg.id).order('name'),
  ]);

  if (rolesResult.error) {
    console.error('[civicService] Error fetching roles for org:', rolesResult.error);
  }
  if (childrenResult.error) {
    console.error('[civicService] Error fetching child orgs:', childrenResult.error);
  }

  const roles = (rolesResult.data || []) as CivicRole[];
  const people = new Map(((peopleResult.data || []) as CivicPerson[]).map(p => [p.id, p]));
  const rolesWithPeople = roles.map(role => ({
    ...role,
    person: people.get(role.person_id) || undefined,
  })) as (CivicRole & { person?: CivicPerson })[];

  // Recursively get roles for children
  const childrenWithRoles: OrgWithRoles[] = await Promise.all(
    ((childrenResult.data || []) as CivicOrg[]).map(async (child) => {
      const { data: childRoles } = await supabase
        .from('roles')
        .select('*')
        .eq('org_id', child.id)
        .eq('is_current', true);

      const childPeople = new Map(((peopleResult.data || []) as CivicPerson[]).map(p => [p.id, p]));
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
    ...typedOrg,
    roles: rolesWithPeople,
    children: childrenWithRoles,
  };
}

export interface DepartmentBudgetRow {
  budget_period: number;
  agency: string;
  budget_amount: number;
  spend_amount: number;
  remaining_amount: number;
  obligated_amount: number;
}

/**
 * Get budget data for an executive department by org slug.
 * Looks up the checkbook agency name via org_agency_map, then returns
 * all available fiscal years from checkbook.budgets, newest first.
 */
export async function getDepartmentBudget(
  orgSlug: string
): Promise<DepartmentBudgetRow[] | null> {
  const supabase = await createSupabaseClient({ auth: false });

  // Resolve org slug → checkbook agency name
  const { data: mapping } = await (supabase as any)
    .schema('checkbook')
    .from('org_agency_map')
    .select('agency_name')
    .eq('org_slug', orgSlug)
    .single();

  if (!mapping?.agency_name) return null;

  // Fetch all budget rows for that agency across all fiscal years
  const { data, error } = await (supabase as any)
    .schema('checkbook')
    .from('budgets')
    .select('budget_period, agency, budget_amount, spend_amount, remaining_amount, obligated_amount')
    .eq('agency', mapping.agency_name)
    .order('budget_period', { ascending: false });

  if (error) {
    console.error('[civicService] getDepartmentBudget error:', error);
    return null;
  }

  return (data ?? []) as DepartmentBudgetRow[];
}

