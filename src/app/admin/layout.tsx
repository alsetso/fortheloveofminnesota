import { requireAdminAccess } from '@/lib/adminHelpers';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Re-enable admin access check in production
  // Top-down protection: All /admin routes require admin role
  // try {
  //   await requireAdminAccess();
  // } catch (error) {
  //   // requireAdminAccess redirects internally, but catch any unexpected errors
  //   redirect('/?message=Access denied. Admin privileges required.');
  // }

  return <>{children}</>;
}

