/**
 * Despia safe-area CSS chains.
 * @see https://setup.despia.com/native-features/safe-areas.md
 * @see https://setup.despia.com/native-features/light-and-dark-mode
 *
 * Prefer these over bare `env(safe-area-inset-*)` or bare `var(--safe-area-top)`.
 * Safe areas are insets — always stack with base padding via calc().
 *
 * Despia Editor: Fullscreen Mode ON + Auto-Inject Safe Area OFF. Leaving
 * Auto-Inject on while we apply these helpers doubles every fixed footer/header.
 * Do not pre-define `--safe-area-*` in CSS as `env(...)` — let the runtime
 * inject them; `env()` is only the fallback in the chain below.
 *
 * `--keyboard-inset` is tracked by DespiaNativeChrome while the WebView stays
 * full-screen (prevent-autoscroll). Opt-in chrome lifts with max(safe, keyboard).
 */

export const SAFE_AREA = {
  top: 'var(--safe-area-top, env(safe-area-inset-top, 0px))',
  bottom: 'var(--safe-area-bottom, env(safe-area-inset-bottom, 0px))',
  left: 'var(--safe-area-left, env(safe-area-inset-left, 0px))',
  right: 'var(--safe-area-right, env(safe-area-inset-right, 0px))',
} as const;

/** Live keyboard height from layout bottom (0 when closed). */
export const KEYBOARD_INSET = 'var(--keyboard-inset, 0px)';

/**
 * Home-indicator OR keyboard — whichever clears more from the bottom edge.
 * Use for footers that should ride above the iOS keyboard while the sheet
 * root stays full-screen behind it.
 */
export const SAFE_OR_KEYBOARD_BOTTOM = `max(${SAFE_AREA.bottom}, ${KEYBOARD_INSET})`;

/** `calc(base + safe-area-top)` — use for fixed/sticky headers. */
export function safePadTop(base = '0.75rem'): string {
  return `calc(${base} + ${SAFE_AREA.top})`;
}

/**
 * Header pad with a floor for contexts that have no status bar to clear.
 *
 * In the native shell the notch inset does the spacing work, but on web and in
 * desktop preview it is 0, which leaves `base` alone hugging the window edge.
 * The floor only ever applies where the inset is smaller than it, so native
 * spacing is unchanged.
 */
export function safePadTopMin(base = '0.75rem', min = '1rem'): string {
  return `calc(${base} + max(${SAFE_AREA.top}, ${min}))`;
}

/** `calc(base + safe-area-bottom)` — use for fixed footers / tab bars. */
export function safePadBottom(base = '0.5rem'): string {
  return `calc(${base} + ${SAFE_AREA.bottom})`;
}

/**
 * Footer pad that lifts with the keyboard (Despia prevent-autoscroll + --keyboard-inset).
 * Falls back to safe-area when the keyboard is closed.
 */
export function safePadBottomKeyboard(base = '0.5rem'): string {
  return `calc(${base} + ${SAFE_OR_KEYBOARD_BOTTOM})`;
}

/**
 * Own-tab chat dock: clear the tab bar when the keyboard is closed; ride the
 * keyboard when open (whichever needs more bottom clearance).
 */
export function safePadBottomTabOrKeyboard(
  tabBarHeightPx: number,
  base = '0.35rem',
): string {
  return `calc(${base} + max(${tabBarHeightPx}px + ${SAFE_AREA.bottom}, ${KEYBOARD_INSET}))`;
}

/** Clear a fixed bottom bar from scroll content (bar height + safe inset). */
export function safeClearBottom(barHeight = '4.5rem'): string {
  return `calc(${barHeight} + ${SAFE_AREA.bottom})`;
}

/** Clear a keyboard-aware bottom bar from scroll content. */
export function safeClearBottomKeyboard(barHeight = '4.5rem'): string {
  return `calc(${barHeight} + ${SAFE_OR_KEYBOARD_BOTTOM})`;
}

/** Clear a fixed top bar from scroll content (bar height + safe inset). */
export function safeClearTop(barHeight = '3.5rem'): string {
  return `calc(${barHeight} + ${SAFE_AREA.top})`;
}
