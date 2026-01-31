import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

/**
 * POST /api/settings/location-preferences
 * Update location preferences for the authenticated user
 * 
 * Body: { 
 *   account_id?: string,
 *   cities_and_towns?: any,
 *   county?: any,
 *   districts?: any
 * }
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId: contextAccountId }) => {
      try {
        const body = await req.json();
        const { account_id, cities_and_towns, county, districts } = body;
        
        if (!userId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

        const supabase = await createServerClientWithAuth(req.cookies as any);

        // Use account_id from request body if provided, otherwise use context accountId
        let targetAccountId: string | null = null;

        if (account_id) {
          // Verify the provided account_id belongs to this user
          const { data: account, error: accountError } = await supabase
            .from('accounts')
            .select('id')
            .eq('id', account_id)
            .eq('user_id', userId)
            .maybeSingle();

          if (accountError || !account) {
            return NextResponse.json(
              { error: 'Account not found or access denied' },
              { status: 403 }
            );
          }
          type AccountRow = { id: string };
          targetAccountId = (account as AccountRow).id;
        } else if (contextAccountId) {
          targetAccountId = contextAccountId;
        } else {
          return NextResponse.json(
            { error: 'Account ID required' },
            { status: 400 }
          );
        }

        // Build update object (only include fields that are provided)
        const updateData: Record<string, any> = {};
        if (cities_and_towns !== undefined) updateData.cities_and_towns = cities_and_towns;
        if (county !== undefined) updateData.county = county;
        if (districts !== undefined) updateData.districts = districts;

        if (Object.keys(updateData).length === 0) {
          return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
          );
        }

        // Update location preferences
        const { data, error } = await (supabase as any)
          .from('accounts')
          .update(updateData)
          .eq('id', targetAccountId)
          .eq('user_id', userId)
          .select('cities_and_towns, county, districts')
          .maybeSingle();

        if (error) {
          console.error('[Location Preferences API] Error:', error);
          return NextResponse.json(
            { error: 'Failed to update location preferences', details: error.message },
            { status: 500 }
          );
        }

        if (!data) {
          return NextResponse.json(
            { error: 'Account not found' },
            { status: 404 }
          );
        }

        return NextResponse.json(data);
      } catch (error) {
        console.error('[Location Preferences API] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      maxRequestSize: 1024 * 100, // Allow larger JSON payloads for boundary data
    }
  );
}
