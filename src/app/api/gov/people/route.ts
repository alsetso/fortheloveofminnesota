import { NextResponse } from 'next/server';
import { createServerClientWithAuth, createServiceClient } from '@/lib/supabase/unified';
import { cookies } from 'next/headers';

/** POST: create a person in civic.people (admin only). Uses service role to avoid RLS/schema issues. */
export async function POST(req: Request) {
  try {
    const supabaseAuth = await createServerClientWithAuth(cookies());
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: account } = await supabaseAuth.from('accounts').select('role').eq('user_id', user.id).maybeSingle();
    if (account?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const payload = {
      name: body.name ?? '',
      slug: body.slug?.trim() || null,
      party: body.party?.trim() || null,
      district: body.district?.trim() || null,
      title: body.title?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      photo_url: body.photo_url?.trim() || null,
      building_id: body.building_id?.trim() || null,
    };
    const service = await createServiceClient();
    const civic = (service as any).schema ? (service as any).schema('civic') : service;
    const { data, error } = await civic.from('people').insert(payload).select('id').single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
