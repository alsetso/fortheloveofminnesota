'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export interface GovSidebarData {
  /** Org page: org name displayed as header */
  orgName?: string;
  /** Org page: org slug for links */
  orgSlug?: string;
  /** Org page: parent org info */
  parentOrg?: { name: string | null; slug: string } | null;
  /** Org page: leadership list */
  leaders?: Array<{ name: string; slug: string | null; title: string; photoUrl: string | null }>;
  /** Org page: building info */
  building?: { name: string | null; slug: string | null } | null;
  /** Org page: budget summary */
  budgetAmount?: number | null;
  /** Org page: budget fiscal year */
  budgetYear?: number | null;
  /** Org page: official website */
  website?: string | null;
  /** Person page: person name */
  personName?: string;
  /** Person page: person slug */
  personSlug?: string;
  /** Person page: primary role title */
  roleTitle?: string | null;
  /** Person page: primary org */
  primaryOrg?: { name: string | null; slug: string } | null;
  /** Person page: contact info */
  contact?: { email?: string | null; phone?: string | null };
  /** Person page: building info */
  personBuilding?: { name: string | null; slug: string | null } | null;
}

interface GovSidebarContextValue {
  data: GovSidebarData;
  setData: (data: GovSidebarData) => void;
}

const GovSidebarContext = createContext<GovSidebarContextValue>({
  data: {},
  setData: () => {},
});

export function GovSidebarProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GovSidebarData>({});
  return (
    <GovSidebarContext.Provider value={{ data, setData }}>
      {children}
    </GovSidebarContext.Provider>
  );
}

export function useGovSidebar() {
  return useContext(GovSidebarContext);
}
