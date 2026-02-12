import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/systems
 * Get all systems and their visibility settings.
 * Analysis is fetched on-demand via /api/admin/systems/[id]/analyze when user expands a system.
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // Use RPC function to query admin schema tables
        const { data: systemsResult, error: systemsError } = await (supabase.rpc as any)('query_table', {
          p_schema_name: 'admin',
          p_table_name: 'system_visibility',
          p_limit: 1000,
          p_offset: 0,
          p_order_by: 'display_order',
          p_order_direction: 'ASC',
        });
        
        if (systemsError) {
          console.error('[Admin Systems API] Error fetching systems:', systemsError);
          return NextResponse.json(
            { error: 'Failed to fetch systems', details: systemsError.message },
            { status: 500 }
          );
        }
        
        // Extract data from RPC result format: [{ data: JSONB array, total_count: N }]
        const resultRow = systemsResult && systemsResult[0];
        const systemsArray = resultRow?.data || [];
        const systems = Array.isArray(systemsArray) ? systemsArray : [];
        
        if (systems.length === 0 && resultRow?.total_count > 0) {
          console.error('[Admin Systems API] Invalid systems data format:', systemsResult);
          return NextResponse.json(
            { error: 'Invalid data format from database' },
            { status: 500 }
          );
        }
        
        // Get route visibility settings for each system (DB only; analysis fetched on expand)
        const systemsWithRoutes = await Promise.all(
          systems.map(async (system: any) => {
            const { data: routesResult } = await (supabase.rpc as any)('query_table', {
              p_schema_name: 'admin',
              p_table_name: 'route_visibility',
              p_limit: 1000,
              p_offset: 0,
              p_order_by: null,
              p_order_direction: 'ASC',
              p_search: null,
              p_filters: { system_id: { '=': system.id } },
            });
            
            const routesRow = routesResult && routesResult[0];
            const routesArray = routesRow?.data || [];
            const routeVisibilitySettings = Array.isArray(routesArray) ? routesArray : [];
            
            return {
              ...system,
              routeVisibilitySettings,
            };
          })
        );
        
        return NextResponse.json({ systems: systemsWithRoutes });
      } catch (error) {
        console.error('[Admin Systems API] Unexpected error:', error);
        return NextResponse.json(
          { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
          { status: 500 }
        );
      }
    },
    {
      requireAdmin: true,
      rateLimit: 'admin',
    }
  );
}

/**
 * PATCH /api/admin/systems
 * Update system visibility settings
 */
export async function PATCH(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        const body = await req.json();
        
        const { systemId, updates } = body;
        
        if (!systemId || !updates) {
          return NextResponse.json(
            { error: 'systemId and updates are required' },
            { status: 400 }
          );
        }
        
        // Use RPC function to update admin schema table
        // Direct updates don't work due to RLS/permissions
        const { data, error } = await (supabase.rpc as any)('update_table', {
          p_schema_name: 'admin',
          p_table_name: 'system_visibility',
          p_id: systemId,
          p_updates: updates,
        });
        
        if (error) {
          console.error('[Admin Systems API] Error updating system:', error);
          return NextResponse.json(
            { error: 'Failed to update system', details: error.message },
            { status: 500 }
          );
        }
        
        // RPC returns JSONB, parse it
        const updatedSystem = typeof data === 'string' ? JSON.parse(data) : data;
        
        return NextResponse.json({ system: updatedSystem });
      } catch (error) {
        console.error('[Admin Systems API] Unexpected error:', error);
        return NextResponse.json(
          { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
          { status: 500 }
        );
      }
    },
    {
      requireAdmin: true,
      rateLimit: 'admin',
    }
  );
}
