import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/accounts/[id]/pins/[pinId]
 * Get one pin. Requires auth; [id] must match pin's account_id.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pinId: string }> }
) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      const { id, pinId } = await params;
      if (!accountId || accountId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const supabase = await createServerClientWithAuth(cookies());
      const { data, error } = await supabase
        .from('map_pins')
        .select(
          `
          id, lat, lng, description, visibility, city_id, collection_id, mention_type_id, map_id,
          image_url, video_url, media_type, view_count, created_at, updated_at,
          collections (id, emoji, title),
          mention_types (id, emoji, name)
        `
        )
        .eq('id', pinId)
        .eq('account_id', id)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
      }
      return NextResponse.json({ pin: data });
    },
    { requireAuth: true, rateLimit: 'authenticated' }
  );
}

/**
 * PATCH /api/accounts/[id]/pins/[pinId]
 * Update a pin. Requires auth; [id] must match pin's account_id.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pinId: string }> }
) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      const { id, pinId } = await params;
      if (!accountId || accountId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (typeof body.lat === 'number' && !Number.isNaN(body.lat)) updates.lat = body.lat;
      if (typeof body.lng === 'number' && !Number.isNaN(body.lng)) updates.lng = body.lng;
      if (body.description !== undefined) updates.description = typeof body.description === 'string' ? body.description : null;
      if (body.collection_id !== undefined) updates.collection_id = typeof body.collection_id === 'string' ? body.collection_id : null;
      if (body.mention_type_id !== undefined) updates.mention_type_id = typeof body.mention_type_id === 'string' ? body.mention_type_id : null;
      if (body.image_url !== undefined) updates.image_url = typeof body.image_url === 'string' ? body.image_url : null;
      if (body.video_url !== undefined) updates.video_url = typeof body.video_url === 'string' ? body.video_url : null;
      if (body.visibility === 'only_me' || body.visibility === 'public') updates.visibility = body.visibility;
      if (body.media_type === 'image' || body.media_type === 'video' || body.media_type === 'none') updates.media_type = body.media_type;
      if (body.full_address !== undefined) updates.full_address = typeof body.full_address === 'string' ? body.full_address : null;
      if (body.city_id !== undefined) updates.city_id = typeof body.city_id === 'string' ? body.city_id : null;

      if (Object.keys(updates).length <= 1) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      const supabase = await createServerClientWithAuth(cookies());
      const { data, error } = await supabase
        .from('map_pins')
        .update(updates)
        .eq('id', pinId)
        .eq('account_id', id)
        .select(
          `
          id, lat, lng, description, visibility, city_id, collection_id, mention_type_id, map_id,
          image_url, video_url, media_type, view_count, created_at, updated_at,
          collections (id, emoji, title),
          mention_types (id, emoji, name)
        `
        )
        .single();

      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('[Pins API]', error);
        return NextResponse.json({ error: 'Failed to update pin' }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
      }
      return NextResponse.json({ pin: data });
    },
    { requireAuth: true, rateLimit: 'authenticated' }
  );
}

/**
 * DELETE /api/accounts/[id]/pins/[pinId]
 * Soft-delete a pin (set archived = true). Requires auth; [id] must match pin's account_id.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pinId: string }> }
) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      const { id, pinId } = await params;
      if (!accountId || accountId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const supabase = await createServerClientWithAuth(cookies());
      const { error } = await supabase
        .from('map_pins')
        .update({ archived: true, updated_at: new Date().toISOString() })
        .eq('id', pinId)
        .eq('account_id', id);

      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('[Pins API]', error);
        return NextResponse.json({ error: 'Failed to delete pin' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    },
    { requireAuth: true, rateLimit: 'authenticated' }
  );
}
