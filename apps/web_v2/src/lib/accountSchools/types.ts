export const ACCOUNT_SCHOOL_KINDS = ['attended', 'attending', 'parent', 'follow'] as const;

export type AccountSchoolKind = (typeof ACCOUNT_SCHOOL_KINDS)[number];

export type AccountSchool = {
  id: string;
  account_id: string;
  school_id: string;
  kind: AccountSchoolKind;
  notify: boolean;
  is_public: boolean;
  created_at: string;
  school_name: string | null;
  school_slug: string | null;
  school_type: string | null;
  district_name: string | null;
  page_slug: string | null;
  lat: number | null;
  lng: number | null;
};

export type AccountSchoolPatch = {
  notify?: boolean;
  is_public?: boolean;
  kind?: AccountSchoolKind;
};

export const ACCOUNT_SCHOOL_SELECT =
  'id, account_id, school_id, kind, notify, is_public, created_at';

export const SCHOOL_KIND_LABEL: Record<AccountSchoolKind, string> = {
  attended: 'Attended',
  attending: 'Attending',
  parent: 'Parent',
  follow: 'Follow',
};

export const SCHOOL_KIND_OPTIONS: Array<{ id: AccountSchoolKind; label: string }> = [
  { id: 'attended', label: 'Attended' },
  { id: 'attending', label: 'Attending' },
  { id: 'parent', label: 'Parent' },
  { id: 'follow', label: 'Follow' },
];

export function kindLabel(kind: AccountSchoolKind): string {
  return SCHOOL_KIND_LABEL[kind];
}

export function isAccountSchoolKind(value: string): value is AccountSchoolKind {
  return (ACCOUNT_SCHOOL_KINDS as readonly string[]).includes(value);
}

export function schoolDisplayName(row: Pick<AccountSchool, 'school_name'>): string {
  return row.school_name?.trim() || 'School';
}

export { formatSchoolType } from '@/lib/schools/format';
