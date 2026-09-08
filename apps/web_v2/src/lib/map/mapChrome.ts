import { APP_CONTENT_MAX_WIDTH_CLASS } from '@/lib/shell/appContentWidth';

/** Layout helpers cloned from ios v1 local-gov / map sheet chrome. */

/** Same column width as AppShell / TabBar on large screens. */
export const LOCAL_GOV_MAP_CHROME_COLUMN_CLASS = `mx-auto w-full ${APP_CONTENT_MAX_WIDTH_CLASS}`;
export const MAP_SHEET_SHELL_X = 'px-3 sm:px-4';
export const MAP_SHEET_BODY_CLASS = `${MAP_SHEET_SHELL_X} pb-4 pt-1`;
