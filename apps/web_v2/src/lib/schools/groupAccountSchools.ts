import type { AccountSchool, AccountSchoolKind } from '@/lib/accountSchools/types';
import { formatSchoolType } from '@/lib/schools/format';
import { kindLabel } from '@/lib/accountSchools/types';

export type AccountSchoolGroup = {
  schoolId: string;
  name: string;
  rows: AccountSchool[];
  kinds: AccountSchoolKind[];
  notify: boolean;
  schoolType: string | null;
  districtName: string | null;
  pageSlug: string | null;
  lat: number | null;
  lng: number | null;
};

export function groupAccountSchools(rows: AccountSchool[]): AccountSchoolGroup[] {
  const map = new Map<string, AccountSchoolGroup>();
  for (const row of rows) {
    const existing = map.get(row.school_id);
    if (existing) {
      existing.rows.push(row);
      if (!existing.kinds.includes(row.kind)) existing.kinds.push(row.kind);
      existing.notify = existing.notify || row.notify;
      continue;
    }
    map.set(row.school_id, {
      schoolId: row.school_id,
      name: row.school_name?.trim() || 'School',
      rows: [row],
      kinds: [row.kind],
      notify: row.notify,
      schoolType: row.school_type,
      districtName: row.district_name,
      pageSlug: row.page_slug,
      lat: row.lat,
      lng: row.lng,
    });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function accountSchoolGroupEyebrow(group: AccountSchoolGroup): string {
  return group.kinds.map((kind) => kindLabel(kind)).join(' · ');
}

export function accountSchoolGroupSubtitle(group: AccountSchoolGroup): string {
  if (group.notify) return 'Updates on';
  const type = formatSchoolType(group.schoolType);
  if (type && group.districtName) return `${type} · ${group.districtName}`;
  return type ?? group.districtName ?? 'K–12 school';
}
