import { createCivicServerClient, createServerClient, createSupabaseClient } from '@/lib/supabaseServer';

export interface CivicAgency {
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
  checkbook_agency_name: string | null;
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
  agency_id: string;
  title: string;
  role_type: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
  person?: CivicPerson;
  org?: CivicAgency;
}

export interface AgencyWithRoles extends CivicAgency {
  roles?: (CivicRole & { person?: CivicPerson })[];
  children?: AgencyWithRoles[];
}

/**
 * Fetch all agencies with their roles and people
 */
export async function getCivicAgencies(): Promise<CivicAgency[]> {
  const supabase = await createCivicServerClient();
  
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .order('name');

  if (error) {
    console.error('[civicService] Error fetching agencies:', error);
    return [];
  }

  return (data || []) as CivicAgency[];
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
  
  const [rolesResult, peopleResult, agenciesResult] = await Promise.all([
    supabase.from('roles').select('*').eq('is_current', true).order('title'),
    supabase.from('people').select('*'),
    supabase.from('agencies').select('*'),
  ]);

  if (rolesResult.error) {
    console.error('[civicService] Error fetching roles:', rolesResult.error);
    return [];
  }

  const roles = (rolesResult.data || []) as any[];
  const people = new Map(((peopleResult.data || []) as CivicPerson[]).map(p => [p.id, p]));
  const agencies = new Map(((agenciesResult.data || []) as CivicAgency[]).map(o => [o.id, o]));

  return roles.map(role => ({
    ...role,
    person: people.get(role.person_id) || undefined,
    org: agencies.get(role.agency_id) || undefined,
  })) as CivicRole[];
}

/**
 * Build organizational tree from agencies
 */
export async function getCivicAgencyTree(): Promise<AgencyWithRoles[]> {
  const [agencies, roles] = await Promise.all([
    getCivicAgencies(),
    getCivicRoles(),
  ]);

  const rolesByAgencyId = new Map<string, (CivicRole & { person?: CivicPerson })[]>();
  roles.forEach(role => {
    if (!rolesByAgencyId.has(role.agency_id)) {
      rolesByAgencyId.set(role.agency_id, []);
    }
    rolesByAgencyId.get(role.agency_id)!.push(role);
  });

  const agenciesById = new Map<string, AgencyWithRoles>();
  agencies.forEach(agency => {
    agenciesById.set(agency.id, {
      ...agency,
      roles: rolesByAgencyId.get(agency.id) || [],
      children: [],
    });
  });

  const roots: AgencyWithRoles[] = [];
  agenciesById.forEach(agency => {
    if (agency.parent_id && agenciesById.has(agency.parent_id)) {
      const parent = agenciesById.get(agency.parent_id)!;
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(agency);
    } else {
      roots.push(agency);
    }
  });

  const sortAgencies = (list: AgencyWithRoles[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    list.forEach(a => {
      if (a.children?.length) sortAgencies(a.children);
    });
  };
  sortAgencies(roots);
  return roots;
}

/**
 * Get agencies by type
 */
export async function getCivicAgenciesByType(type: 'branch' | 'agency' | 'department' | 'court'): Promise<AgencyWithRoles[]> {
  const tree = await getCivicAgencyTree();
  return tree.filter(agency => agency.org_type === type);
}

/**
 * Get a single person by slug or ID with all their roles and building
 */
export async function getCivicPersonBySlug(slug: string): Promise<{
  person: CivicPerson;
  roles: (CivicRole & { org?: CivicAgency })[];
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

  const typedRoles = (rolesResult.data || []) as CivicRole[];
  const agencyIds = [...new Set(typedRoles.map(r => r.agency_id))];
  const { data: agencies } = agencyIds.length
    ? await supabase.from('agencies').select('*').in('id', agencyIds)
    : { data: [] };

  const agenciesMap = new Map(((agencies || []) as CivicAgency[]).map(o => [o.id, o]));

  return {
    person: typedPerson,
    roles: typedRoles.map(role => ({
      ...role,
      org: agenciesMap.get(role.agency_id) || undefined,
    })) as (CivicRole & { org?: CivicAgency })[],
    building: (buildingResult.data as CivicBuilding | null) ?? null,
  };
}

/**
 * Get a single agency with building and parent agency info
 */
export async function getCivicAgencyWithBuilding(slug: string): Promise<(CivicAgency & {
  gov_type?: string | null;
  branch?: string | null;
  building: CivicBuilding | null;
  parent: CivicAgency | null;
}) | null> {
  const supabase = await createCivicServerClient();

  const { data: agency, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !agency) return null;

  const typed = agency as CivicAgency & { gov_type?: string | null; branch?: string | null; building_id?: string | null; parent_id?: string | null };

  const [buildingResult, parentResult] = await Promise.all([
    typed.building_id
      ? supabase.from('buildings').select('*').eq('id', typed.building_id).single()
      : Promise.resolve({ data: null }),
    typed.parent_id
      ? supabase.from('agencies').select('*').eq('id', typed.parent_id).single()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...typed,
    building: (buildingResult.data as CivicBuilding | null) ?? null,
    parent: (parentResult.data as CivicAgency | null) ?? null,
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

  const { data: agency } = await supabase
    .from('agencies')
    .select('id')
    .eq('slug', orgSlug)
    .single();

  if (!agency) return [];

  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('person_id, title')
    .eq('agency_id', (agency as any).id)
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
  org: CivicAgency & { gov_type?: string | null };
}[]> {
  const supabase = await createCivicServerClient();

  const slugOrder = ['governor', 'lieutenant-governor', 'attorney-general', 'secretary-of-state', 'state-auditor'];

  const { data: agencies } = await supabase
    .from('agencies')
    .select('*')
    .eq('branch', 'executive')
    .eq('gov_type', 'elected_office');

  if (!agencies?.length) return [];

  const agencyIds = agencies.map((o: any) => o.id);

  const { data: roles } = await supabase
    .from('roles')
    .select('*')
    .in('agency_id', agencyIds)
    .eq('is_current', true);

  if (!roles?.length) return [];

  const personIds = roles.map((r: any) => r.person_id);
  const { data: people } = await supabase
    .from('people')
    .select('*')
    .in('id', personIds);

  if (!people?.length) return [];

  const peopleMap = new Map((people as CivicPerson[]).map(p => [p.id, p]));
  const agenciesMap = new Map((agencies as any[]).map(o => [o.id, o]));

  const results = (roles as CivicRole[]).map(role => ({
    person: peopleMap.get(role.person_id)!,
    role,
    org: agenciesMap.get(role.agency_id)!,
  })).filter(r => r.person && r.org);

  results.sort((a, b) => {
    const ai = slugOrder.indexOf(a.org.slug);
    const bi = slugOrder.indexOf(b.org.slug);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return results;
}

export interface AgencyWithBudget extends CivicAgency {
  /** Most recent available FY budget total in dollars */
  budget_amount?: number | null;
  budget_year?: number | null;
}

/**
 * Get departments and agencies under the Governor, with FY2026 budget totals merged in.
 */
export async function getGovernorSubAgencies(): Promise<{
  departments: AgencyWithBudget[];
  agencies: AgencyWithBudget[];
  boards: AgencyWithBudget[];
}> {
  const supabase = await createCivicServerClient();
  const checkbookClient = await createSupabaseClient({ auth: false });

  const { data: govAgency } = await supabase
    .from('agencies')
    .select('id')
    .eq('slug', 'governor')
    .single();

  if (!govAgency) return { departments: [], agencies: [], boards: [] };

  const { data: children } = await supabase
    .from('agencies')
    .select('*')
    .eq('parent_id', (govAgency as any).id)
    .order('name');

  if (!children) return { departments: [], agencies: [], boards: [] };

  const typed = children as AgencyWithBudget[];

  // Collect agency names that have a checkbook mapping
  const agencyNames = typed
    .map(o => o.checkbook_agency_name)
    .filter((n): n is string => !!n);

  // Fetch most recent budget totals per agency in one query (try FY2026 first, fallback handled below)
  let budgetMap = new Map<string, { amount: number; year: number }>();
  if (agencyNames.length > 0) {
    // Fetch FY2025 + FY2026 rows so we always have at least one year
    const { data: budgetRows } = await (checkbookClient as any)
      .schema('checkbook')
      .from('budgets')
      .select('agency, budget_amount, budget_period')
      .in('agency', agencyNames)
      .in('budget_period', [2025, 2026]);

    if (budgetRows) {
      // Group by agency, pick the latest year with non-zero amount
      for (const row of budgetRows as { agency: string; budget_amount: number; budget_period: number }[]) {
        const existing = budgetMap.get(row.agency);
        const amount = Number(row.budget_amount);
        if (amount > 0 && (!existing || row.budget_period > existing.year)) {
          budgetMap.set(row.agency, { amount, year: row.budget_period });
        }
      }
      // Aggregate rows for the same agency+year (budget rows may be multi-fund)
      const aggregated = new Map<string, { amount: number; year: number }>();
      for (const row of budgetRows as { agency: string; budget_amount: number; budget_period: number }[]) {
        const amount = Number(row.budget_amount);
        if (amount <= 0) continue;
        const existing = aggregated.get(row.agency);
        if (!existing) {
          aggregated.set(row.agency, { amount, year: row.budget_period });
        } else if (row.budget_period > existing.year) {
          aggregated.set(row.agency, { amount, year: row.budget_period });
        } else if (row.budget_period === existing.year) {
          aggregated.set(row.agency, { amount: existing.amount + amount, year: existing.year });
        }
      }
      budgetMap = aggregated;
    }
  }

  // Merge budget data onto each org
  const withBudget = typed.map(o => {
    const b = o.checkbook_agency_name ? budgetMap.get(o.checkbook_agency_name) : undefined;
    return {
      ...o,
      budget_amount: b?.amount ?? null,
      budget_year: b?.year ?? null,
    };
  });

  return {
    departments: withBudget.filter(o => o.gov_type === 'department'),
    agencies: withBudget.filter(o => o.gov_type === 'authority' || o.gov_type === 'office'),
    boards: withBudget.filter(o => o.gov_type === 'board' || o.gov_type === 'commission' || o.gov_type === 'council'),
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
  courts: (CivicAgency & { gov_type?: string | null })[];
  leaders: JudicialLeader[];
  districts: JudicialDistrict[];
}> {
  const supabase = await createCivicServerClient();
  const layersClient = await createServerClient();

  const [courtsResult, rolesResult, districtsResult] = await Promise.all([
    supabase
      .from('agencies')
      .select('*')
      .eq('branch', 'judicial')
      .eq('org_type', 'court')
      .order('name'),
    supabase
      .from('roles')
      .select('title, person_id, agency_id')
      .eq('is_current', true),
    (layersClient as any)
      .schema('layers')
      .from('jurisdictions')
      .select('district_number, name, slug, description')
      .eq('jurisdiction_type', 'judicial')
      .order('district_number'),
  ]);

  const courts = (courtsResult.data ?? []) as (CivicAgency & { gov_type?: string | null })[];

  const courtIds = new Set(courts.map(c => c.id));
  const judicialRoles = (rolesResult.data ?? []).filter((r: any) => courtIds.has(r.agency_id));

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
        const court = courtsMap.get(r.agency_id);
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
 * Get agencies for a branch (executive | legislative | judicial)
 */
export async function getBranchAgencies(
  branch: 'executive' | 'legislative' | 'judicial'
): Promise<(CivicAgency & { gov_type?: string | null })[]> {
  const supabase = await createCivicServerClient();
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('branch', branch)
    .order('name');
  if (error) return [];
  return (data ?? []) as (CivicAgency & { gov_type?: string | null })[];
}

/**
 * Get a single building by id, with linked people, agencies, and roles
 */
export async function getCivicBuildingById(id: string): Promise<{
  building: CivicBuilding;
  people: CivicPerson[];
  agencies: CivicAgency[];
} | null> {
  const supabase = await createCivicServerClient();

  const [buildingResult, peopleResult, agenciesResult] = await Promise.all([
    supabase.from('buildings').select('*').eq('id', id).single(),
    supabase.from('people').select('*').eq('building_id', id).order('name'),
    supabase.from('agencies').select('*').eq('building_id', id).order('name'),
  ]);

  if (buildingResult.error || !(buildingResult as any).data) return null;

  return {
    building: (buildingResult as any).data as CivicBuilding,
    people: ((peopleResult as any).data ?? []) as CivicPerson[],
    agencies: ((agenciesResult as any).data ?? []) as CivicAgency[],
  };
}

/**
 * Get a single agency with its roles
 */
export async function getCivicAgencyBySlug(slug: string): Promise<AgencyWithRoles | null> {
  const supabase = await createCivicServerClient();
  
  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .select('*')
    .eq('slug', slug)
    .single();

  if (agencyError || !agency) {
    return null;
  }

  const typed = agency as CivicAgency;

  const [rolesResult, peopleResult, childrenResult] = await Promise.all([
    supabase.from('roles').select('*').eq('agency_id', typed.id).eq('is_current', true).order('title'),
    supabase.from('people').select('*'),
    supabase.from('agencies').select('*').eq('parent_id', typed.id).order('name'),
  ]);

  if (rolesResult.error) {
    console.error('[civicService] Error fetching roles for agency:', rolesResult.error);
  }
  if (childrenResult.error) {
    console.error('[civicService] Error fetching child agencies:', childrenResult.error);
  }

  const roles = (rolesResult.data || []) as CivicRole[];
  const people = new Map(((peopleResult.data || []) as CivicPerson[]).map(p => [p.id, p]));
  const rolesWithPeople = roles.map(role => ({
    ...role,
    person: people.get(role.person_id) || undefined,
  })) as (CivicRole & { person?: CivicPerson })[];

  const childrenWithRoles: AgencyWithRoles[] = await Promise.all(
    ((childrenResult.data || []) as CivicAgency[]).map(async (child) => {
      const { data: childRoles } = await supabase
        .from('roles')
        .select('*')
        .eq('agency_id', child.id)
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
    ...typed,
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
 * Get budget data for an org by slug.
 * Reads checkbook_agency_name directly from civic.agencies, then returns
 * all available fiscal years from checkbook.budgets, newest first.
 */
export async function getDepartmentBudget(
  agencySlug: string
): Promise<DepartmentBudgetRow[] | null> {
  const supabase = await createSupabaseClient({ auth: false });

  const { data: agency } = await supabase
    .schema('civic')
    .from('agencies')
    .select('checkbook_agency_name')
    .eq('slug', agencySlug)
    .single();

  if (!agency?.checkbook_agency_name) return null;

  // Fetch all budget rows for that agency across all fiscal years
  const { data, error } = await (supabase as any)
    .schema('checkbook')
    .from('budgets')
    .select('budget_period, agency, budget_amount, spend_amount, remaining_amount, obligated_amount')
    .eq('agency', agency.checkbook_agency_name)
    .order('budget_period', { ascending: false });

  if (error) {
    console.error('[civicService] getDepartmentBudget error:', error);
    return null;
  }

  return (data ?? []) as DepartmentBudgetRow[];
}

export interface OrgJurisdiction {
  district_number: number | null;
  name: string;
  slug: string;
  description: string | null;
  jurisdiction_type: string | null;
}

/**
 * Fetch jurisdictions linked to an org via civic_org_id (for legislative/judicial orgs).
 */
export async function getOrgJurisdictions(orgId: string): Promise<OrgJurisdiction[]> {
  const supabase = await createSupabaseClient({ auth: false });

  const { data, error } = await (supabase as any)
    .schema('layers')
    .from('jurisdictions')
    .select('district_number, name, slug, description, jurisdiction_type')
    .eq('civic_org_id', orgId)
    .order('district_number', { ascending: true });

  if (error) {
    console.error('[civicService] getOrgJurisdictions error:', error);
    return [];
  }

  return (data ?? []) as OrgJurisdiction[];
}

export interface OrgContractRow {
  payee: string;
  contract_type: string;
  total_contract_amount: number;
  start_date: string;
  end_date: string | null;
  contract_id: string;
}

/**
 * Get top contracts for an org by slug, ordered by total amount descending.
 * Returns null if the org has no checkbook_agency_name set.
 */
export async function getOrgContracts(
  agencySlug: string,
  limit = 10
): Promise<OrgContractRow[] | null> {
  const supabase = await createSupabaseClient({ auth: false });

  const { data: agency } = await supabase
    .schema('civic')
    .from('agencies')
    .select('checkbook_agency_name')
    .eq('slug', agencySlug)
    .single();

  if (!agency?.checkbook_agency_name) return null;

  const { data, error } = await (supabase as any)
    .schema('checkbook')
    .from('contracts')
    .select('payee, contract_type, total_contract_amount, start_date, end_date, contract_id')
    .eq('agency', agency.checkbook_agency_name)
    .order('total_contract_amount', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[civicService] getOrgContracts error:', error);
    return null;
  }

  return (data ?? []) as OrgContractRow[];
}

export type AgencyPayrollSummary = {
  fiscal_year: number;
  total_employees: number;
  total_wages: number;
  average_wages: number;
  total_overtime: number;
};

/**
 * Get payroll summary for an org by slug (one fiscal year).
 * Uses checkbook_agency_name from civic.agencies; returns null if unset or no payroll rows.
 */
export async function getAgencyPayroll(
  agencySlug: string,
  fiscalYear = 2025
): Promise<AgencyPayrollSummary | null> {
  const supabase = await createSupabaseClient({ auth: false });

  const { data: agency } = await supabase
    .schema('civic')
    .from('agencies')
    .select('checkbook_agency_name')
    .eq('slug', agencySlug)
    .single();

  if (!agency?.checkbook_agency_name) return null;

  const { data: rows, error } = await (supabase as any)
    .schema('checkbook')
    .from('payroll')
    .select('employee_name, total_wages, overtime_wages')
    .eq('agency_name', agency.checkbook_agency_name)
    .eq('fiscal_year', String(fiscalYear));

  if (error) {
    console.error('[civicService] getAgencyPayroll error:', error);
    return null;
  }

  if (!rows?.length) return null;

  const names = new Set((rows as { employee_name: string | null }[]).map((r) => r.employee_name ?? '').filter(Boolean));
  const total_employees = names.size;
  const total_wages = (rows as { total_wages: number }[]).reduce((s, r) => s + Number(r.total_wages ?? 0), 0);
  const total_overtime = (rows as { overtime_wages: number }[]).reduce((s, r) => s + Number(r.overtime_wages ?? 0), 0);
  const average_wages = total_employees > 0 ? total_wages / total_employees : 0;

  return {
    fiscal_year: fiscalYear,
    total_employees,
    total_wages,
    average_wages,
    total_overtime,
  };
}

/** Escape value for use in ilike pattern (allow % and _ as literals) */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export interface DirectorySearchAgency {
  id: string;
  name: string;
  slug: string;
  branch: string | null;
  gov_type: string | null;
  description: string | null;
}

export interface DirectorySearchPerson {
  id: string;
  name: string;
  slug: string | null;
  party: string | null;
  district: string | null;
  title?: string | null;
  roles?: Array<{ title: string; agencies: { branch: string; name: string; slug: string } | null }>;
}

export interface DirectorySearchRole {
  id: string;
  title: string;
  person_id: string;
  agency_id: string;
  people: { id: string; name: string; slug: string | null; party: string | null } | null;
  agencies: { id: string; name: string; slug: string; branch: string | null } | null;
}

export interface DirectorySearchResult {
  agencies: DirectorySearchAgency[];
  people: DirectorySearchPerson[];
  roles: DirectorySearchRole[];
}

/**
 * Search directory across agencies (name, description), people (name, district), and roles (title).
 */
export async function searchDirectory(query: string): Promise<DirectorySearchResult> {
  const supabase = await createCivicServerClient();
  const q = query.trim();
  if (!q) {
    return { agencies: [], people: [], roles: [] };
  }
  const pattern = `%${escapeIlike(q)}%`;

  const [agenciesRes, peopleRes, rolesRes] = await Promise.all([
    supabase
      .from('agencies')
      .select('id, name, slug, branch, gov_type, description')
      .or(`name.ilike.${pattern},description.ilike.${pattern}`)
      .limit(5),
    supabase
      .from('people')
      .select('id, name, slug, party, district, title')
      .or(`name.ilike.${pattern},district.ilike.${pattern},title.ilike.${pattern}`)
      .limit(5),
    supabase
      .from('roles')
      .select('id, title, person_id, agency_id, people(id, name, slug, party), agencies(id, name, slug, branch)')
      .eq('is_current', true)
      .ilike('title', pattern)
      .limit(5),
  ]);

  const peopleData = (peopleRes.data ?? []) as Array<{
    id: string;
    name: string;
    slug: string | null;
    party: string | null;
    district: string | null;
    title: string | null;
  }>;
  const personIds = peopleData.map((p) => p.id);

  // Attach current roles (with agency) for people so client can show title/org and branch
  let peopleWithRoles: DirectorySearchPerson[] = peopleData.map((p) => ({
    ...p,
    roles: undefined,
  }));
  if (personIds.length > 0) {
    const { data: rolesData } = await supabase
      .from('roles')
      .select('person_id, title, agencies(branch, name, slug)')
      .in('person_id', personIds)
      .eq('is_current', true);
    const rolesByPerson = new Map<string, Array<{ title: string; agencies: { branch: string; name: string; slug: string } | null }>>();
    (rolesData ?? []).forEach((r: any) => {
      const list = rolesByPerson.get(r.person_id) ?? [];
      list.push({
        title: r.title,
        agencies: r.agencies ?? null,
      });
      rolesByPerson.set(r.person_id, list);
    });
    peopleWithRoles = peopleData.map((p) => ({
      ...p,
      roles: rolesByPerson.get(p.id) ?? [],
    }));
  }

  return {
    agencies: (agenciesRes.data ?? []) as DirectorySearchAgency[],
    people: peopleWithRoles,
    roles: (rolesRes.data ?? []) as DirectorySearchRole[],
  };
}

export interface DirectoryOverviewCounts {
  agencyCount: number;
  peopleCount: number;
  roleCount: number;
  buildingCount: number;
}

export interface DirectoryBranchSummary {
  agencyCount: number;
  peopleCount: number;
  /** Executive: e.g. "$171B+ budget" */
  budgetLabel?: string | null;
  /** Legislative: senate member count */
  senateCount?: number;
  /** Legislative: house member count */
  houseCount?: number;
  /** Judicial: court count (e.g. 3) */
  courtCount?: number;
  /** Judicial: district count (e.g. 10) */
  districtCount?: number;
}

export interface DirectoryOverview {
  counts: DirectoryOverviewCounts;
  branchSummaries: {
    executive: DirectoryBranchSummary;
    legislative: DirectoryBranchSummary;
    judicial: DirectoryBranchSummary;
  };
}

/**
 * Fetch directory overview: total counts and per-branch summaries for the dashboard.
 */
export async function getDirectoryOverview(): Promise<DirectoryOverview> {
  const supabase = await createCivicServerClient();

  const [
    agenciesRes,
    peopleRes,
    rolesRes,
    buildingsRes,
    agenciesByBranchRes,
    rolesWithAgencyRes,
  ] = await Promise.all([
    supabase.from('agencies').select('id', { count: 'exact', head: true }),
    supabase.from('people').select('id', { count: 'exact', head: true }),
    supabase.from('roles').select('id', { count: 'exact', head: true }),
    supabase.from('buildings').select('id', { count: 'exact', head: true }),
    supabase.from('agencies').select('id, branch, slug, org_type'),
    supabase.from('roles').select('person_id, agency_id').eq('is_current', true),
  ]);

  const agencyCount = agenciesRes.count ?? 0;
  const peopleCount = peopleRes.count ?? 0;
  const roleCount = rolesRes.count ?? 0;
  const buildingCount = buildingsRes.count ?? 0;

  const agencies = (agenciesByBranchRes.data ?? []) as Array<{
    id: string;
    branch: string | null;
    slug: string | null;
    org_type: string | null;
  }>;
  const rolesWithAgency = (rolesWithAgencyRes.data ?? []) as Array<{
    person_id: string;
    agency_id: string;
  }>;

  const agencyById = new Map(agencies.map((a) => [a.id, a]));
  const execAgencyIds = new Set(agencies.filter((a) => a.branch === 'executive').map((a) => a.id));
  const legAgencyIds = new Set(agencies.filter((a) => a.branch === 'legislative').map((a) => a.id));
  const judAgencyIds = new Set(agencies.filter((a) => a.branch === 'judicial').map((a) => a.id));

  const execPersonIds = new Set(
    rolesWithAgency
      .filter((r) => execAgencyIds.has(r.agency_id))
      .map((r) => r.person_id)
  );
  const legPersonIds = new Set(
    rolesWithAgency
      .filter((r) => legAgencyIds.has(r.agency_id))
      .map((r) => r.person_id)
  );
  const judPersonIds = new Set(
    rolesWithAgency
      .filter((r) => judAgencyIds.has(r.agency_id))
      .map((r) => r.person_id)
  );

  const execAgencies = agencies.filter((a) => a.branch === 'executive');
  const legAgencies = agencies.filter((a) => a.branch === 'legislative');
  const judAgencies = agencies.filter((a) => a.branch === 'judicial');

  const senateSlug = legAgencies.find((a) => (a.slug ?? '').includes('senate'))?.id;
  const houseSlug = legAgencies.find((a) => (a.slug ?? '').includes('house'))?.id;
  const senateCount = senateSlug
    ? rolesWithAgency.filter((r) => r.agency_id === senateSlug).length
    : 0;
  const houseCount = houseSlug
    ? rolesWithAgency.filter((r) => r.agency_id === houseSlug).length
    : 0;

  const courtCount = judAgencies.filter(
    (a) =>
      (a.slug ?? '').startsWith('mn-') &&
      ((a.org_type ?? '') === 'court' || (a.slug ?? '').includes('court'))
  ).length || 3;
  const districtCount = judAgencies.filter((a) =>
    (a.slug ?? '').includes('judicial-district')
  ).length || 10;

  let budgetLabel: string | null = null;
  try {
    const checkbookClient = await createSupabaseClient({ auth: false });
    const { data: budgetRows } = await (checkbookClient as any)
      .schema('checkbook')
      .from('budgets')
      .select('budget_amount')
      .limit(5000);
    if (Array.isArray(budgetRows) && budgetRows.length > 0) {
      const total = (budgetRows as { budget_amount?: number }[]).reduce(
        (sum, r) => sum + (Number(r.budget_amount) || 0),
        0
      );
      if (total > 0) {
        const billions = total / 1e9;
        budgetLabel = billions >= 1 ? `$${billions.toFixed(0)}B+ budget` : `$${(total / 1e6).toFixed(0)}M+ budget`;
      }
    }
  } catch {
    budgetLabel = '$171B+ budget';
  }

  return {
    counts: { agencyCount, peopleCount, roleCount, buildingCount },
    branchSummaries: {
      executive: {
        agencyCount: execAgencies.length,
        peopleCount: execPersonIds.size,
        budgetLabel: budgetLabel ?? '$171B+ budget',
      },
      legislative: {
        agencyCount: legAgencies.length,
        peopleCount: legPersonIds.size,
        senateCount: senateCount || 67,
        houseCount: houseCount || 134,
      },
      judicial: {
        agencyCount: judAgencies.length,
        peopleCount: judPersonIds.size,
        courtCount: courtCount,
        districtCount: districtCount,
      },
    },
  };
}

// Backward-compat aliases (prefer CivicAgency / getCivicAgencyBySlug / getBranchAgencies / getGovernorSubAgencies)
export type CivicOrg = CivicAgency;
export type OrgWithRoles = AgencyWithRoles;
export type OrgWithBudget = AgencyWithBudget;
export const getCivicOrgBySlug = getCivicAgencyBySlug;
export const getCivicOrgWithBuilding = getCivicAgencyWithBuilding;
export const getBranchOrgs = getBranchAgencies;
export const getGovernorSubOrgs = getGovernorSubAgencies;
