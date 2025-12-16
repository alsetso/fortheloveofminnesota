import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { getServerAccount } from '@/lib/accountServer';
import type { UserMap } from '@/features/user-maps/types';
import SimplePageLayout from '@/components/SimplePageLayout';
import MapDetailWrapper from './MapDetailWrapper';

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function MapDetailPage({ params }: Props) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies
        },
      },
    }
  );
  const account = await getServerAccount();

  // Fetch map data - RLS will handle access control
  // Using direct query here since services use browser client
  const { data: map, error } = await supabase
    .from('maps')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !map) {
    console.error('[MapDetailPage] Error fetching map:', error);
    notFound();
  }

  return (
    <SimplePageLayout 
      backgroundColor="bg-black" 
      contentPadding="px-0 py-0" 
      containerMaxWidth="full" 
      hideFooter={true}
      toolbar={<div id="map-detail-toolbar-slot" />}
    >
      <MapDetailWrapper mapId={id} initialMap={map as UserMap} account={account} />
    </SimplePageLayout>
  );
}
