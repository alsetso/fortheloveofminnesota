/** Shared callback when a lookup archive is ready for identify → confirm. */
export type OpenToolResultOpts = {
  title: string;
  subtitle?: string;
  archiveKind: 'people' | 'properties';
  lookupId: string;
};

export type OpenToolResultHandler = (opts: OpenToolResultOpts) => void;

export function toolResultSlug(archiveKind: 'people' | 'properties', lookupId: string): string {
  return `${archiveKind}:${lookupId}`;
}
