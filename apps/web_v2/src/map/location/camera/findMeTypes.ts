/**
 * Shared types for useFindMe / useFollowCamera to avoid circular imports.
 */

export type FindMeOptions = {
  /**
   * Camera when the first GPS fix arrives.
   * - `fly` — user gesture spline (default)
   * - `jump` — instant (cold open, no cache)
   * - `ease` — short refine after a cached jump
   * - `none` — blue dot only
   */
  camera?: 'fly' | 'jump' | 'ease' | 'none';
  /** Skip status toasts (silent resume). Default false. */
  quiet?: boolean;
  /** Soft resume: never trigger an OS permission prompt. Default false. */
  avoidPrompt?: boolean;
  /**
   * Override the target zoom for the initial camera attach.
   * Defaults to MAP_CONFIG.FIND_ME_ZOOM. Pass ZOOM_STATE_CLOSE to land
   * in the follow-mode close frame instead of the street-level default.
   */
  zoom?: number;
  /**
   * Explicit bearing (degrees CW from north) to use for the initial fly animation.
   * Pass the current device heading so the transition from Explore→Locked
   * animates bearing and position together rather than a two-step snap.
   */
  bearing?: number | null;
};
