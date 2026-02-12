import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { withSecurity } from '@/lib/security/middleware';

interface SchemaInfo {
  schema_name: string;
  tables: Array<{
    table_name: string;
    table_type: string;
  }>;
}

/**
 * GET /api/admin/schemas
 * Admin-only endpoint to fetch all database schemas and their tables
 * 
 * Security:
 * - Requires admin role
 * - Rate limited: admin preset
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // Use the public.get_schemas_and_tables() function via RPC
        // This is a wrapper that calls admin.get_schemas_and_tables()
        const { data, error } = await (supabase.rpc as any)('get_schemas_and_tables', {}) as {
          data: Array<{ schema_name: string; table_name: string; table_type: string }> | null;
          error: any;
        };

        if (error) {
          console.error('[Admin Schemas API] RPC Error:', error);
          throw error;
        }

        // Group tables by schema
        const schemaMap = new Map<string, SchemaInfo>();
        (data || []).forEach((row) => {
          if (!schemaMap.has(row.schema_name)) {
            schemaMap.set(row.schema_name, {
              schema_name: row.schema_name,
              tables: [],
            });
          }
          schemaMap.get(row.schema_name)!.tables.push({
            table_name: row.table_name,
            table_type: row.table_type,
          });
        });

        const schemas = Array.from(schemaMap.values()).sort((a, b) =>
          a.schema_name.localeCompare(b.schema_name)
        );

        return NextResponse.json({ schemas });
      } catch (error) {
        console.error('[Admin Schemas API] Error:', error);
        
        // Fallback to known schemas without table details
        const knownSchemas: SchemaInfo[] = [
          { schema_name: 'public', tables: [] },
          { schema_name: 'billing', tables: [] },
          { schema_name: 'maps', tables: [] },
          { schema_name: 'analytics', tables: [] },
          { schema_name: 'layers', tables: [] },
          { schema_name: 'id', tables: [] },
          { schema_name: 'pro', tables: [] },
          { schema_name: 'news', tables: [] },
          { schema_name: 'atlas', tables: [] },
          { schema_name: 'civic', tables: [] },
        ];

        return NextResponse.json({ schemas: knownSchemas });
      }
    },
    {
      requireAdmin: true,
      rateLimit: 'admin',
    }
  );
}
