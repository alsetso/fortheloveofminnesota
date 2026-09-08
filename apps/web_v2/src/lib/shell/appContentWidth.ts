/**
 * Shared large-screen column for App shell chrome (header, scroll body, tab bar)
 * and map dock sheets. Keep the Tailwind class literal in sync with the px value —
 * Tailwind cannot see dynamic class names.
 */
export const APP_CONTENT_MAX_WIDTH_PX = 800;

/** `max-w-[800px]` — must match {@link APP_CONTENT_MAX_WIDTH_PX}. */
export const APP_CONTENT_MAX_WIDTH_CLASS = 'max-w-[800px]';

/** Horizontal gutter for TopBar / shell header rows. */
export const APP_SHELL_GUTTER_X_CLASS = 'px-4';
