/**
 * PATCH /api/notifications/[id]
 * Update a notification (mark as read, archive, etc.)
 * 
 * DELETE /api/notifications/[id]
 * Delete a notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        const supabase = await createServerClientWithAuth(cookies());
        const body = await req.json();

        // Only allow updating read/archived status
        const updates: {
          read?: boolean;
          read_at?: string;
          archived?: boolean;
          archived_at?: string;
        } = {};

        if (body.read !== undefined) {
          updates.read = body.read;
          if (body.read) {
            updates.read_at = new Date().toISOString();
          }
        }

        if (body.archived !== undefined) {
          updates.archived = body.archived;
          if (body.archived) {
            updates.archived_at = new Date().toISOString();
          }
        }

        const { data, error } = await supabase
          .schema('notifications')
          .from('alerts')
          .update(updates)
          .eq('id', id)
          .eq('account_id', accountId!)
          .select()
          .single();

        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ notification: data });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in PATCH /api/notifications/[id]:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
    }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        const supabase = await createServerClientWithAuth(cookies());

        const { error } = await supabase
          .schema('notifications')
          .from('alerts')
          .delete()
          .eq('id', id)
          .eq('account_id', accountId!);

        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in DELETE /api/notifications/[id]:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
    }
  );
}
