/**
 * Admin privilege — `public.accounts.role === 'admin'`.
 * Not billing (`plan`) and not `contributor` role.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? '').trim().toLowerCase() === 'admin';
}
