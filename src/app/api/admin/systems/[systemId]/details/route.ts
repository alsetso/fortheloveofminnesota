import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/systems/[systemId]/details
 * Get manually entered system details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const { systemId } = await params;
        const supabase = await createServerClientWithAuth(cookies());
        
        // Try direct query first (same approach as PUT handler)
        const { data: directData, error: directError } = await supabase
          .schema('admin')
          .from('system_details')
          .select('*')
          .eq('system_id', systemId)
          .maybeSingle();
        
        if (!directError && directData) {
          return NextResponse.json({
            routes: directData.routes || [],
            databaseTables: directData.database_tables || [],
            apiRoutes: directData.api_routes || [],
            files: directData.files || { components: [], services: [], hooks: [], types: [], utils: [] },
          });
        }
        
        // Fallback to RPC if direct query fails
        const { data: detailsResult, error: detailsError } = await (supabase.rpc as any)('query_table', {
          p_schema_name: 'admin',
          p_table_name: 'system_details',
          p_limit: 1000,
          p_offset: 0,
          p_order_by: null,
          p_order_direction: 'ASC',
          p_search: null,
          p_filters: { system_id: { '=': systemId } },
        });
        
        if (detailsError) {
          console.error('[Admin System Details API] RPC error:', detailsError);
          return NextResponse.json(
            { error: 'Failed to fetch system details', details: detailsError.message },
            { status: 500 }
          );
        }
        
        // Extract data from RPC result format: [{ data: JSONB array, total_count: N }]
        const resultRow = detailsResult && detailsResult[0];
        const detailsArray = resultRow?.data || [];
        
        // Parse JSONB array if it's a string
        const parsedArray = Array.isArray(detailsArray) 
          ? detailsArray 
          : (typeof detailsArray === 'string' ? JSON.parse(detailsArray) : []);
        
        const details = parsedArray.find((d: any) => d.system_id === systemId) || parsedArray[0];
        
        if (details) {
          return NextResponse.json({
            routes: details.routes || [],
            databaseTables: details.database_tables || [],
            apiRoutes: details.api_routes || [],
            files: details.files || { components: [], services: [], hooks: [], types: [], utils: [] },
          });
        }
        
        // Return empty if not found
        return NextResponse.json({
          routes: [],
          databaseTables: [],
          apiRoutes: [],
          files: { components: [], services: [], hooks: [], types: [], utils: [] },
        });
      } catch (error) {
        console.error('[Admin System Details API] Error:', error);
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
 * PUT /api/admin/systems/[systemId]/details
 * Save manually entered system details
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const { systemId } = await params;
        const details = await req.json();
        const supabase = await createServerClientWithAuth(cookies());
        
        // Upsert system details
        const { data, error } = await supabase
          .schema('admin')
          .from('system_details')
          .upsert({
            system_id: systemId,
            routes: details.routes || [],
            database_tables: details.databaseTables || [],
            api_routes: details.apiRoutes || [],
            files: details.files || { components: [], services: [], hooks: [], types: [], utils: [] },
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'system_id',
          })
          .select()
          .single();
        
        if (error) {
          return NextResponse.json(
            { error: 'Failed to save system details', details: error.message },
            { status: 500 }
          );
        }
        
        return NextResponse.json({ success: true, details: data });
      } catch (error) {
        console.error('[Admin System Details API] Error:', error);
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
