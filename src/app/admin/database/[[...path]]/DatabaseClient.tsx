'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import { useAuthStateSafe } from '@/features/auth';
import SchemaSidebar from '@/components/admin/SchemaSidebar';
import TableDataViewer from '@/components/admin/TableDataViewer';

interface DatabaseClientProps {
  schema?: string;
  table?: string;
}

export default function DatabaseClient({ schema, table }: DatabaseClientProps) {
  const { account, user } = useAuthStateSafe();
  const router = useRouter();

  // Verify admin access
  useEffect(() => {
    if (!user) {
      return;
    }
    
    if (account !== undefined && account !== null && account.role !== 'admin') {
      router.push('/');
    }
  }, [account, user, router]);

  const handleTableSelect = (selectedSchema: string, selectedTable: string) => {
    router.push(`/admin/database/${selectedSchema}/${selectedTable}`);
  };

  return (
    <>
      <PageViewTracker />
      <NewPageWrapper
        leftSidebar={
          <SchemaSidebar
            onTableSelect={handleTableSelect}
            selectedSchema={schema}
            selectedTable={table}
          />
        }
      >
        {schema && table ? (
          <TableDataViewer schema={schema} table={table} />
        ) : (
          <div className="p-[10px]">
            <div className="text-xs text-foreground-muted">
              Select a schema and table from the sidebar to view data
            </div>
          </div>
        )}
      </NewPageWrapper>
    </>
  );
}
