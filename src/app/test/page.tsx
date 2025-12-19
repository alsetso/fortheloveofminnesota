import { createServerClientWithAuth } from '@/lib/supabaseServer';
import TestClient from './TestClient';

export const dynamic = 'force-dynamic';

export default async function TestPage() {
  const supabase = await createServerClientWithAuth();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  // Get account if user is authenticated
  let account = null;
  if (user) {
    const { data: accountData } = await supabase
      .from('accounts')
      .select('id, username, first_name, last_name, image_url, user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    account = accountData;
  }

  return <TestClient account={account} />;
}

