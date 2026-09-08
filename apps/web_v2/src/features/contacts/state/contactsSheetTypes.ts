/** Contact book kinds — people, addresses, and saved directory pages. */
export type ContactsSheetKind = 'people' | 'addresses' | 'businesses';

export type ContactsSheetOpenOpts = {
  /** Default `people` (iOS Contacts is people-first). */
  kind?: ContactsSheetKind;
  /** Prefill search field. */
  query?: string;
  /** Exact tag filter (from Lists → Tags). */
  tag?: string | null;
};

export type ContactsSheetState = {
  kind: ContactsSheetKind;
  query: string;
  tag: string | null;
};
