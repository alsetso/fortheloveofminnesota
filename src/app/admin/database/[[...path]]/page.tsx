import { requireAdminAccess } from '@/lib/adminHelpers';
import DatabaseClient from './DatabaseClient';

interface DatabasePageProps {
  params: Promise<{
    path?: string[];
  }>;
}

export default async function DatabasePage({ params }: DatabasePageProps) {
  await requireAdminAccess();
  
  const { path } = await params;
  const schema = path?.[0];
  const table = path?.[1];
  
  return <DatabaseClient schema={schema} table={table} />;
}
