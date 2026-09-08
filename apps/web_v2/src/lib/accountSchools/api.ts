import { createClient } from '@/lib/supabase/client';
import {
  getAccountSchools,
  removeAccountSchool,
  setAccountSchools,
  upsertAccountSchool,
} from '@/lib/accountSchools/store';
import {
  ACCOUNT_SCHOOL_KINDS,
  ACCOUNT_SCHOOL_SELECT,
  isAccountSchoolKind,
  type AccountSchool,
  type AccountSchoolKind,
  type AccountSchoolPatch,
} from '@/lib/accountSchools/types';

export type {
  AccountSchool,
  AccountSchoolKind,
  AccountSchoolPatch,
} from '@/lib/accountSchools/types';
export {
  ACCOUNT_SCHOOL_KINDS,
  SCHOOL_KIND_LABEL,
  SCHOOL_KIND_OPTIONS,
  kindLabel,
  schoolDisplayName,
  formatSchoolType,
} from '@/lib/accountSchools/types';

type SchoolMeta = {
  name: string;
  slug: string | null;
  school_type: string | null;
  district_name: string | null;
  page_slug: string | null;
  lat: number | null;
  lng: number | null;
};

async function loadSchoolMeta(schoolIds: string[]): Promise<Map<string, SchoolMeta>> {
  const unique = [...new Set(schoolIds.filter(Boolean))];
  const next = new Map<string, SchoolMeta>();
  if (unique.length === 0) return next;

  const supabase = createClient();
  const { data: schools, error } = await supabase
    .schema('territory')
    .from('schools')
    .select('id, name, slug, school_type, school_district_id, lat, lng, page_id')
    .in('id', unique);

  if (error) throw new Error(error.message || 'Could not load schools.');

  const districtIds = [
    ...new Set(
      (schools ?? [])
        .map((s) => s.school_district_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const districtNameById = new Map<string, string>();
  if (districtIds.length > 0) {
    const { data: districts } = await supabase
      .schema('territory')
      .from('school_districts')
      .select('id, name')
      .in('id', districtIds);
    for (const d of districts ?? []) {
      if (d?.id && d?.name) districtNameById.set(String(d.id), String(d.name));
    }
  }

  const pageIds = [
    ...new Set(
      (schools ?? [])
        .map((s) => s.page_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const slugByPageId = new Map<string, string>();
  if (pageIds.length > 0) {
    const { data: pages } = await supabase
      .schema('page')
      .from('pages')
      .select('id, slug')
      .in('id', pageIds);
    for (const page of pages ?? []) {
      if (page?.id && page?.slug) slugByPageId.set(String(page.id), String(page.slug));
    }
  }

  for (const row of schools ?? []) {
    const id = String(row.id);
    const districtName = row.school_district_id
      ? districtNameById.get(String(row.school_district_id)) ?? null
      : null;
    next.set(id, {
      name: String(row.name ?? 'School'),
      slug: row.slug ? String(row.slug) : null,
      school_type: row.school_type ? String(row.school_type) : null,
      district_name: districtName,
      page_slug: row.page_id ? slugByPageId.get(String(row.page_id)) ?? null : null,
      lat: typeof row.lat === 'number' && Number.isFinite(row.lat) ? row.lat : null,
      lng: typeof row.lng === 'number' && Number.isFinite(row.lng) ? row.lng : null,
    });
  }
  return next;
}

function asSchool(row: unknown, meta?: Map<string, SchoolMeta>): AccountSchool {
  const item = row as AccountSchool;
  const kind = isAccountSchoolKind(item.kind) ? item.kind : 'follow';
  const schoolMeta = meta?.get(item.school_id);
  const prev = getAccountSchools().find((school) => school.id === item.id);
  return {
    ...item,
    kind,
    school_name: schoolMeta?.name ?? prev?.school_name ?? null,
    school_slug: schoolMeta?.slug ?? prev?.school_slug ?? null,
    school_type: schoolMeta?.school_type ?? prev?.school_type ?? null,
    district_name: schoolMeta?.district_name ?? prev?.district_name ?? null,
    page_slug: schoolMeta?.page_slug ?? prev?.page_slug ?? null,
    lat: schoolMeta?.lat ?? prev?.lat ?? null,
    lng: schoolMeta?.lng ?? prev?.lng ?? null,
  };
}

function dbMessage(error: { message?: string } | null, fallback: string): string {
  return error?.message || fallback;
}

async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

export async function listAccountSchools(accountId: string): Promise<AccountSchool[]> {
  await requireUserId();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('account_schools')
    .select(ACCOUNT_SCHOOL_SELECT)
    .eq('account_id', accountId)
    .in('kind', [...ACCOUNT_SCHOOL_KINDS])
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message || 'Could not load schools.');
  const meta = await loadSchoolMeta((data ?? []).map((row) => (row as AccountSchool).school_id));
  const rows = (data ?? []).map((row) => asSchool(row, meta));
  setAccountSchools(accountId, rows);
  return rows;
}

export async function updateAccountSchool(
  accountId: string,
  id: string,
  patch: AccountSchoolPatch,
): Promise<AccountSchool> {
  await requireUserId();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('account_schools')
    .update(patch)
    .eq('id', id)
    .eq('account_id', accountId)
    .select(ACCOUNT_SCHOOL_SELECT)
    .single();
  if (error || !data) throw new Error(dbMessage(error, 'Could not save.'));
  const meta = await loadSchoolMeta([(data as AccountSchool).school_id]);
  const row = asSchool(data, meta);
  upsertAccountSchool(row);
  return row;
}

export async function deleteAccountSchool(accountId: string, id: string): Promise<void> {
  await requireUserId();
  const supabase = createClient();
  const { error } = await supabase
    .from('account_schools')
    .delete()
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(dbMessage(error, 'Could not remove school.'));
  removeAccountSchool(id);
}

export async function ensureSchoolKind(
  accountId: string,
  schoolId: string,
  kind: AccountSchoolKind,
): Promise<AccountSchool> {
  await requireUserId();
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('account_schools')
    .select(ACCOUNT_SCHOOL_SELECT)
    .eq('account_id', accountId)
    .eq('kind', kind)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (existing?.id) {
    const meta = await loadSchoolMeta([schoolId]);
    const row = asSchool(existing, meta);
    upsertAccountSchool(row);
    return row;
  }

  const sibling = getAccountSchools().find(
    (row) => row.school_id === schoolId && row.notify,
  );

  const { data, error } = await supabase
    .from('account_schools')
    .insert({
      account_id: accountId,
      school_id: schoolId,
      kind,
      notify: sibling?.notify ?? true,
      is_public: true,
    })
    .select(ACCOUNT_SCHOOL_SELECT)
    .single();
  if (error || !data) throw new Error(dbMessage(error, 'Could not save that tag.'));
  const meta = await loadSchoolMeta([schoolId]);
  const row = asSchool(data, meta);
  upsertAccountSchool(row);
  return row;
}

/** Follow a school (follow kind + notify on). */
export async function followSchool(accountId: string, schoolId: string): Promise<AccountSchool> {
  const row = await ensureSchoolKind(accountId, schoolId, 'follow');
  if (!row.notify) {
    return updateAccountSchool(accountId, row.id, { notify: true });
  }
  return row;
}

export async function removeSchoolKind(
  accountId: string,
  schoolId: string,
  kind: AccountSchoolKind,
): Promise<void> {
  const row = getAccountSchools().find(
    (school) => school.school_id === schoolId && school.kind === kind,
  );
  if (!row) return;
  await deleteAccountSchool(accountId, row.id);
}

export async function removeSchool(accountId: string, schoolId: string): Promise<void> {
  const rows = getAccountSchools().filter((school) => school.school_id === schoolId);
  for (const row of rows) {
    await deleteAccountSchool(accountId, row.id);
  }
}

export async function setSchoolNotify(
  accountId: string,
  schoolId: string,
  notify: boolean,
): Promise<void> {
  const rows = getAccountSchools().filter((school) => school.school_id === schoolId);
  await Promise.all(rows.map((row) => updateAccountSchool(accountId, row.id, { notify })));
}
