import { isAdminRole } from '@/lib/auth/isAdminAccount';
import { isLocalhostHost } from '@/lib/isLocalhostHost';

/**
 * Route / Directions (Where I'm at + Selected point → Your route)
 * is limited to localhost or accounts.role === 'admin'.
 */
export function canUseRouteFeature(input: {
  host?: string | null;
  role?: string | null;
}): boolean {
  if (isLocalhostHost(input.host)) return true;
  return isAdminRole(input.role);
}
