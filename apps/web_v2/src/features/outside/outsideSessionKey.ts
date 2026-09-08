/**
 * Shared sessionStorage key for the outside-MN gate.
 * Both OutsideMNGate (/game) and OutsideOverlay (/outside) must use this
 * exact key so their reads/writes stay in sync across navigation.
 */
export const OUTSIDE_MN_SESSION_KEY = 'ftlom_mn_checked';
