/**
 * GET /api/notifications
 * Get notifications for the authenticated user's account
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import type { NotificationFilters } from '@/types/notification';

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        const { searchParams } = new URL(req.url);

        // Parse filters from query params
        const filters: NotificationFilters = {
          account_id: accountId!,
          read: searchParams.get('read') === 'true' ? true : searchParams.get('read') === 'false' ? false : undefined,
          archived: searchParams.get('archived') === 'true' ? true : searchParams.get('archived') === 'false' ? false : undefined,
          event_type: searchParams.get('event_type') as any,
          priority: searchParams.get('priority') as any,
          limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
          offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
        };

        // Build query
        let query = supabase
          .schema('notifications')
          .from('alerts')
          .select('*')
          .eq('account_id', accountId!)
          .order('created_at', { ascending: false });

        if (filters.read !== undefined) {
          query = query.eq('read', filters.read);
        }

        if (filters.archived !== undefined) {
          query = query.eq('archived', filters.archived);
        }

        if (filters.event_type) {
          query = query.eq('event_type', filters.event_type);
        }

        if (filters.priority) {
          query = query.eq('priority', filters.priority);
        }

        if (filters.limit) {
          query = query.limit(filters.limit);
        }

        if (filters.offset) {
          query = query.range(
            filters.offset,
            filters.offset + (filters.limit || 50) - 1
          );
        }

        const { data, error } = await query;

        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ notifications: data || [] });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/notifications:', error);
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
