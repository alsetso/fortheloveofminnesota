import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/admin/database/[schema]/[table]
 * Admin-only endpoint to fetch table data
 * 
 * Security:
 * - Requires admin role
 * - Rate limited: admin preset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ schema: string; table: string }> }
) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const { schema, table } = await params;
        const supabase = await createServerClientWithAuth(cookies());
        
        const searchParams = req.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000); // Max 1000 rows
        const offset = (page - 1) * limit;
        const orderBy = searchParams.get('orderBy') || null;
        const orderDirection = searchParams.get('orderDirection') || 'ASC';
        const search = searchParams.get('search') || null;
        const filtersParam = searchParams.get('filters');
        let filters: Record<string, Record<string, string>> | null = null;
        
        if (filtersParam) {
          try {
            filters = JSON.parse(filtersParam);
          } catch (e) {
            // Invalid JSON, ignore filters
            filters = null;
          }
        }

        // Validate schema and table names to prevent SQL injection
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return NextResponse.json(
            { error: 'Invalid schema or table name' },
            { status: 400 }
          );
        }

        // Validate orderBy column name if provided
        if (orderBy && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(orderBy)) {
          return NextResponse.json(
            { error: 'Invalid orderBy column name' },
            { status: 400 }
          );
        }

        // Validate orderDirection
        if (orderDirection && !['ASC', 'DESC'].includes(orderDirection.toUpperCase())) {
          return NextResponse.json(
            { error: 'Invalid orderDirection. Must be ASC or DESC' },
            { status: 400 }
          );
        }

        // Use admin.query_table function for all schemas
        // This works for public and non-public schemas
        const { data: queryResult, error: queryError } = await (supabase as any).rpc('query_table', {
          p_schema_name: schema,
          p_table_name: table,
          p_limit: limit,
          p_offset: offset,
          p_order_by: orderBy,
          p_order_direction: orderDirection.toUpperCase(),
          p_search: search,
          p_filters: filters as any,
        });

        if (queryError) {
          console.error('[Admin Database API] RPC Error:', queryError);
          return NextResponse.json(
            { error: `Failed to fetch table data: ${(queryError as Error)?.message ?? 'Unknown'}` },
            { status: 500 }
          );
        }

        // Extract data and count from result
        const resultRow = queryResult && (queryResult as any[])[0];
        const dataArray = (resultRow as { data?: unknown; total_count?: number } | null)?.data || [];
        const totalCount = (resultRow as { data?: unknown; total_count?: number } | null)?.total_count ?? 0;

        // Convert JSONB array to regular array
        const data = Array.isArray(dataArray) ? dataArray : [];

        // Extract column names from first row
        const columns = data && data.length > 0 
          ? Object.keys(data[0]).sort()
          : [];

        return NextResponse.json({
          schema,
          table,
          data: data || [],
          columns,
          total: totalCount || 0,
          page,
          limit,
        });
      } catch (error) {
        console.error('[Admin Database API] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
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
