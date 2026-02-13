import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';

/**
 * GET /api/pins/[pinId]
 * Fetch single pin from public.map_pins (for /maps page pin details)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pinId: string }> }
) {
  try {
    const { pinId } = await params;
    const supabase = await createServerClientWithAuth(cookies());

    const { data: pin, error } = await supabase
      .from('map_pins')
      .select(`
        id,
        map_id,
        lat,
        lng,
        description,
        caption,
        emoji,
        image_url,
        video_url,
        account_id,
        mention_type_id,
        created_at,
        view_count,
        full_address
      `)
      .eq('id', pinId)
      .eq('visibility', 'public')
      .eq('is_active', true)
      .eq('archived', false)
      .single();

    if (error || !pin) {
      return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    }

    const [accountRes, typeRes] = await Promise.all([
      pin.account_id
        ? supabase.from('accounts').select('id, username, first_name, last_name, image_url').eq('id', pin.account_id).single()
        : Promise.resolve({ data: null }),
      pin.mention_type_id
        ? supabase.from('mention_types').select('id, emoji, name').eq('id', pin.mention_type_id).single()
        : Promise.resolve({ data: null }),
    ]);

    return NextResponse.json({
      id: pin.id,
      map_id: pin.map_id,
      lat: pin.lat ?? 0,
      lng: pin.lng ?? 0,
      description: pin.description || pin.caption || null,
      caption: pin.caption || null,
      emoji: pin.emoji || null,
      image_url: pin.image_url || null,
      video_url: pin.video_url || null,
      account_id: pin.account_id || null,
      created_at: pin.created_at,
      view_count: (pin as { view_count?: number }).view_count ?? null,
      account: accountRes.data || null,
      mention_type: typeRes.data || null,
    });
  } catch (error) {
    console.error('[Pins API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updatePinSchema = z.object({
  caption: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  emoji: z.string().nullable().optional(),
  visibility: z.enum(['public', 'only_me']).optional(),
});

/**
 * PUT /api/pins/[pinId]
 * Update a pin
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ pinId: string }> }
) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      try {
        if (!accountId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { pinId } = await params;
        const supabase = await createServerClientWithAuth(cookies());
        const body = await req.json();
        
        const validation = updatePinSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request data', details: validation.error.issues },
            { status: 400 }
          );
        }

        // Check if pin exists and belongs to account (public.map_pins)
        const { data: pin, error: pinError } = await supabase
          .from('map_pins')
          .select('account_id')
          .eq('id', pinId)
          .eq('account_id', accountId)
          .single();

        if (pinError || !pin) {
          return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
        }

        const updatePayload: Record<string, unknown> = {
          ...validation.data,
          updated_at: new Date().toISOString(),
        };

        const { data: updatedPin, error: updateError } = await supabase
          .from('map_pins')
          .update(updatePayload)
          .eq('id', pinId)
          .eq('account_id', accountId)
          .select(
            `
            id, lat, lng, description, visibility, city_id, collection_id, mention_type_id, map_id,
            image_url, video_url, media_type, view_count, created_at, updated_at,
            collections (id, emoji, title),
            mention_types (id, emoji, name)
          `
          )
          .single();

        if (updateError) {
          console.error('[Pins API] Error updating pin:', updateError);
          return NextResponse.json({ error: 'Failed to update pin' }, { status: 500 });
        }

        return NextResponse.json({ pin: updatedPin });
      } catch (error) {
        console.error('[Pins API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    {
      requireAuth: true,
      rateLimit: 'authenticated',
    }
  );
}

/**
 * DELETE /api/pins/[pinId]
 * Delete (soft delete) a pin
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pinId: string }> }
) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      try {
        if (!accountId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { pinId } = await params;
        const supabase = await createServerClientWithAuth(cookies());

        const { data: pin, error: pinError } = await supabase
          .from('map_pins')
          .select('account_id')
          .eq('id', pinId)
          .eq('account_id', accountId)
          .single();

        if (pinError || !pin) {
          return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
        }

        const { error: deleteError } = await supabase
          .from('map_pins')
          .update({ archived: true, updated_at: new Date().toISOString() })
          .eq('id', pinId)
          .eq('account_id', accountId);

        if (deleteError) {
          console.error('[Pins API] Error deleting pin:', deleteError);
          return NextResponse.json({ error: 'Failed to delete pin' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('[Pins API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    {
      requireAuth: true,
      rateLimit: 'authenticated',
    }
  );
}
