import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';

const updatePinSchema = z.object({
  caption: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  emoji: z.string().nullable().optional(),
  visibility: z.enum(['public', 'private']).optional(),
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

        // Check if pin exists and belongs to account
        const { data: pin, error: pinError } = await supabase
          .from('map_pins')
          .select('account_id')
          .eq('id', pinId)
          .eq('account_id', accountId)
          .single();

        if (pinError || !pin) {
          return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
        }

        // Update pin
        const updatePayload: Record<string, any> = {
          ...validation.data,
          updated_at: new Date().toISOString(),
        };
        const { data: updatedPin, error: updateError } = await (supabase as any)
          .from('map_pins')
          .update(updatePayload)
          .eq('id', pinId)
          .select(`
            *,
            map:map(id, name, slug, custom_slug),
            mention_type:mention_types(id, emoji, name)
          `)
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

        // Check if pin exists and belongs to account
        const { data: pin, error: pinError } = await supabase
          .from('map_pins')
          .select('account_id')
          .eq('id', pinId)
          .eq('account_id', accountId)
          .single();

        if (pinError || !pin) {
          return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
        }

        // Soft delete pin
        const deletePayload: Record<string, any> = { 
          is_active: false, 
          updated_at: new Date().toISOString() 
        };
        const { error: deleteError } = await (supabase as any)
          .from('map_pins')
          .update(deletePayload)
          .eq('id', pinId);

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
