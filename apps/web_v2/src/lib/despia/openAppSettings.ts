/**
 * Open the native app permissions page (iOS / Android Settings).
 * Despia docs: https://setup.despia.com/native-features/app-settings.md
 *
 * After a one-time system denial, this is the only path to re-grant location.
 */

import { despiaCall, isDespia } from '@/lib/despia/despia';

/** Fire-and-forget; returns true when the Settings deep link was issued. */
export async function openAppSettings(): Promise<boolean> {
  if (!isDespia()) return false;
  await despiaCall('settingsapp://');
  return true;
}
