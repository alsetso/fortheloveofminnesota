import { ReactNode } from 'react';
import GovLayoutClient from './GovLayoutClient';

interface GovLayoutProps {
  children: ReactNode;
}

/**
 * Gov layout — wraps all /gov/* routes with:
 * - GovSidebarProvider (context for page-specific sidebar data)
 * - NewPageWrapper with LeftSidebar + GovSubNav + GovContextSidebar
 *
 * Page components that previously owned their own NewPageWrapper with
 * leftSidebar/subSidebar props (GovPageClient, ExecutivePageClient, etc.)
 * are updated in Phase 3 to render their content directly.
 *
 * Pages that previously used a bare <NewPageWrapper> (person, org, people,
 * orgs, roles, checkbook) have had their <NewPageWrapper> wrappers removed
 * and now get their layout from this file.
 */
export default function GovLayout({ children }: GovLayoutProps) {
  return <GovLayoutClient>{children}</GovLayoutClient>;
}
