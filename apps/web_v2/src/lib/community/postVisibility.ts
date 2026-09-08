/**
 * Community post visibility for feed / detail surfaces.
 *
 * - `public`  — everyone (All + Following)
 * - `shared`  — followers of the author (Following only)
 * - `only_me` / `draft` — author only (never in community feeds)
 */
export const POST_VISIBILITY = {
  public: 'public',
  shared: 'shared',
  onlyMe: 'only_me',
} as const;

export type PostVisibility =
  (typeof POST_VISIBILITY)[keyof typeof POST_VISIBILITY] | string;

export type EditablePostVisibility =
  | typeof POST_VISIBILITY.public
  | typeof POST_VISIBILITY.shared
  | typeof POST_VISIBILITY.onlyMe;

export const POST_VISIBILITY_OPTIONS: {
  id: EditablePostVisibility;
  label: string;
}[] = [
  { id: POST_VISIBILITY.public, label: 'Public' },
  { id: POST_VISIBILITY.shared, label: 'Followers' },
  { id: POST_VISIBILITY.onlyMe, label: 'Only me' },
];

const EDITABLE_VISIBILITY = new Set<string>([
  POST_VISIBILITY.public,
  POST_VISIBILITY.shared,
  POST_VISIBILITY.onlyMe,
]);

/** Map DB values (e.g. legacy `draft`) to the compose/edit picker. */
export function normalizeEditableVisibility(
  raw: string | null | undefined,
): EditablePostVisibility {
  if (raw === POST_VISIBILITY.shared) return POST_VISIBILITY.shared;
  if (raw === POST_VISIBILITY.onlyMe || raw === 'draft') return POST_VISIBILITY.onlyMe;
  return POST_VISIBILITY.public;
}

export function isEditablePostVisibility(
  value: string,
): value is EditablePostVisibility {
  return EDITABLE_VISIBILITY.has(value);
}

/** Shapes that belong on the community feed (exclude territory bulletins, etc.). */
export const FEED_CONTENT_SHAPES = ['standard', 'story'] as const;

export function isFeedContentShape(shape: string | null | undefined): boolean {
  if (!shape) return true; // legacy rows without shape → treat as standard
  return (FEED_CONTENT_SHAPES as readonly string[]).includes(shape);
}

/**
 * Can this viewer see the post outside of owner tools?
 * Owner always sees their own active posts (including only_me).
 */
export function canViewerSeePost(opts: {
  visibility: string | null | undefined;
  accountId: string | null | undefined;
  viewerAccountId: string | null | undefined;
  /** True when viewer follows the author (accepted follow edge). */
  viewerFollowsAuthor?: boolean;
  isActive?: boolean | null;
  archived?: boolean | null;
  expiresAt?: string | null;
}): boolean {
  if (opts.isActive === false) return false;
  if (opts.archived) return false;
  if (opts.expiresAt) {
    const exp = Date.parse(opts.expiresAt);
    if (Number.isFinite(exp) && exp <= Date.now()) return false;
  }

  const isOwner = Boolean(
    opts.viewerAccountId &&
      opts.accountId &&
      opts.viewerAccountId === opts.accountId,
  );
  if (isOwner) return true;

  const visibility = opts.visibility ?? POST_VISIBILITY.public;
  if (visibility === POST_VISIBILITY.public) return true;
  if (visibility === POST_VISIBILITY.shared) {
    return Boolean(opts.viewerFollowsAuthor);
  }
  return false;
}
