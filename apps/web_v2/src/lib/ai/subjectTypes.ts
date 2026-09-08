export const SUBJECT_TYPE_TERRITORY_UNIT = 'territory_unit' as const;
export const SUBJECT_TYPE_GENERAL = 'general' as const;

export type AiSubjectType =
  | typeof SUBJECT_TYPE_TERRITORY_UNIT
  | typeof SUBJECT_TYPE_GENERAL
  | (string & {});

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value));
}
