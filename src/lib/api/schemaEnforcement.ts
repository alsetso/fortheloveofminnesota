/**
 * Schema Enforcement for API Routes
 * 
 * Ensures all API routes respect system visibility before querying schemas.
 * Throws errors if schema is not accessible, preventing unauthorized access.
 */

import { NextResponse } from 'next/server';
import { isSchemaAccessible, getSystemForSchema } from '../admin/schemaMapping';
import type { SystemVisibility } from '../admin/systemVisibility';

/**
 * Route-to-Schema mapping
 * Maps route paths to their corresponding database schemas
 */
const ROUTE_SCHEMA_MAP: Record<string, string> = {
  '/api/maps': 'maps',
  '/api/map': 'maps',
  '/api/posts': 'content',
  '/api/post': 'content',
  '/api/mentions': 'public', // map_pins table is in public schema
  '/api/mention': 'public',
  '/api/gov': 'civic',
  '/api/civic': 'civic',
  '/api/feed': 'feeds',
  '/api/stories': 'stories',
  '/api/pages': 'pages',
  '/api/friends': 'social_graph',
  '/api/messages': 'messaging',
  '/api/places': 'places',
  '/api/ad_center': 'ads',
  '/api/analytics': 'analytics',
  '/api/news': 'news',
  '/api/collections': 'public', // collections table is in public schema
  '/api/people': 'civic',
  '/api/saved': 'public',
  '/api/memories': 'public',
  '/api/marketplace': 'public',
  '/api/explore': 'places',
  '/api/billing': 'billing',
  '/api/admin': 'admin',
};

/**
 * Get schema name for an API route path
 */
export function getSchemaForRoute(routePath: string): string | null {
  // Check exact matches first
  if (ROUTE_SCHEMA_MAP[routePath]) {
    return ROUTE_SCHEMA_MAP[routePath];
  }
  
  // Check prefix matches (e.g., /api/maps/123 -> maps)
  for (const [route, schema] of Object.entries(ROUTE_SCHEMA_MAP)) {
    if (routePath.startsWith(route + '/') || routePath === route) {
      return schema;
    }
  }
  
  return null;
}

/**
 * Check if an API route's schema is accessible
 * Throws error if not accessible
 */
export async function enforceSchemaAccess(
  routePath: string,
  userId?: string
): Promise<{ schema: string; system: SystemVisibility }> {
  const schemaName = getSchemaForRoute(routePath);
  
  if (!schemaName) {
    // If no schema mapping, allow (backward compatibility for routes without schema)
    throw new Error(`No schema mapping found for route: ${routePath}`);
  }
  
  // Check if schema is accessible
  const accessible = await isSchemaAccessible(schemaName, userId);
  
  if (!accessible) {
    const system = await getSystemForSchema(schemaName);
    const systemName = system?.system_name || schemaName;
    throw new Error(`Schema "${schemaName}" (${systemName}) is not accessible. System may be disabled.`);
  }
  
  const system = await getSystemForSchema(schemaName);
  if (!system) {
    throw new Error(`System not found for schema: ${schemaName}`);
  }
  
  return { schema: schemaName, system };
}

/**
 * Middleware wrapper for API routes that enforces schema access
 * 
 * @example
 * export async function GET(request: NextRequest) {
 *   return enforceApiSchemaAccess(request, async (req, { schema, userId }) => {
 *     // schema is guaranteed to be accessible
 *     const supabase = await createSupabaseClient({ auth: true });
 *     const { data } = await supabase.schema(schema).from('table').select('*');
 *     return NextResponse.json({ data });
 *   });
 * }
 */
export async function enforceApiSchemaAccess<T>(
  request: Request,
  handler: (
    request: Request,
    context: { schema: string; system: SystemVisibility; userId?: string }
  ) => Promise<Response>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const routePath = url.pathname;
    
    // Extract userId from request (if available)
    // This would need to be implemented based on your auth setup
    const userId = undefined; // TODO: Extract from request
    
    const { schema, system } = await enforceSchemaAccess(routePath, userId);
    
    return handler(request, { schema, system, userId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Schema access denied';
    return NextResponse.json(
      { error: message },
      { status: 403 }
    );
  }
}
