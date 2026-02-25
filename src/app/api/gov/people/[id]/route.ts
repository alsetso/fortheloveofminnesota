import { NextResponse } from 'next/server';
import { createServerClientWithAuth, createServiceClient } from '@/lib/supabase/unified';
import { cookies } from 'next/headers';

/** PATCH: update a person in civic.people (admin only). Uses service role to avoid RLS/schema issues. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const supabaseAuth = await createServerClientWithAuth(cookies());
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: account } = await supabaseAuth
      .from('accounts')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle() as { data: { role?: 'general' | 'admin' } | null };
    if (account?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const payload: Record<string, unknown> = {};
    if (body.name !== undefined) payload.name = body.name;
    if (body.slug !== undefined) payload.slug = body.slug?.trim() || null;
    if (body.party !== undefined) payload.party = body.party?.trim() || null;
    if (body.district !== undefined) payload.district = body.district?.trim() || null;
    if (body.title !== undefined) payload.title = body.title?.trim() || null;
    if (body.email !== undefined) payload.email = body.email?.trim() || null;
    if (body.phone !== undefined) payload.phone = body.phone?.trim() || null;
    if (body.address !== undefined) payload.address = body.address?.trim() || null;
    if (body.photo_url !== undefined) payload.photo_url = body.photo_url?.trim() || null;
    if (body.building_id !== undefined) payload.building_id = body.building_id?.trim() || null;
    const service = await createServiceClient();
    const civic = (service as any).schema ? (service as any).schema('civic') : service;
    const { error } = await civic.from('people').update(payload).eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
