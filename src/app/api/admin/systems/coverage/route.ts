import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * GET /api/admin/systems/coverage
 * Check which routes are covered by systems and which are not
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // Get all systems
        const { data: systemsResult, error: systemsError } = await (supabase.rpc as any)('query_table', {
          p_schema_name: 'admin',
          p_table_name: 'system_visibility',
          p_limit: 1000,
          p_offset: 0,
          p_order_by: null,
          p_order_direction: 'ASC',
          p_search: null,
          p_filters: null,
        });
        
        if (systemsError) {
          return NextResponse.json(
            { error: 'Failed to fetch systems', details: systemsError.message },
            { status: 500 }
          );
        }
        
        const systemsResultRow = systemsResult && systemsResult[0];
        const systemsArray = systemsResultRow?.data || [];
        const systems = Array.isArray(systemsArray) ? systemsArray : [];
        
        // Scan all routes
        const appDir = join(process.cwd(), 'src/app');
        const allRoutes: string[] = [];
        
        function scanRoutes(dir: string, currentPath: string = '') {
          try {
            const entries = readdirSync(dir);
            for (const entry of entries) {
              const fullPath = join(dir, entry);
              const stat = statSync(fullPath);
              
              if (stat.isDirectory()) {
                if (entry.startsWith('.') || entry === 'node_modules' || entry === '.next' || entry === 'api') {
                  continue;
                }
                const nextPath = currentPath ? `${currentPath}/${entry}` : entry;
                scanRoutes(fullPath, nextPath);
              } else if (entry === 'page.tsx' || entry === 'page.ts') {
                const routePath = currentPath === '' ? '/' : `/${currentPath}`;
                allRoutes.push(routePath);
              }
            }
          } catch (error) {
            // Skip
          }
        }
        
        scanRoutes(appDir);
        
        // Map routes to systems
        const routeCoverage = allRoutes.map(route => {
          // Homepage is always allowed
          if (route === '/') {
            return {
              route,
              covered: true,
              systemId: null,
              systemName: 'Homepage (always accessible)',
            };
          }
          
          // Find which system covers this route
          const coveringSystem = systems.find((system: any) => {
            const primaryRoute = system.primary_route;
            return route === primaryRoute || route.startsWith(primaryRoute + '/');
          });
          
          return {
            route,
            covered: !!coveringSystem,
            systemId: coveringSystem?.id || null,
            systemName: coveringSystem?.system_name || null,
            systemRoute: coveringSystem?.primary_route || null,
          };
        });
        
        const coveredRoutes = routeCoverage.filter(r => r.covered);
        const uncoveredRoutes = routeCoverage.filter(r => !r.covered);
        
        // Group uncovered routes by primary segment
        const uncoveredBySegment = new Map<string, string[]>();
        uncoveredRoutes.forEach(({ route }) => {
          if (route === '/') return;
          const segments = route.split('/').filter(Boolean);
          const primarySegment = segments[0] || 'root';
          if (!uncoveredBySegment.has(primarySegment)) {
            uncoveredBySegment.set(primarySegment, []);
          }
          uncoveredBySegment.get(primarySegment)!.push(route);
        });
        
        return NextResponse.json({
          totalRoutes: allRoutes.length,
          coveredRoutes: coveredRoutes.length,
          uncoveredRoutes: uncoveredRoutes.length,
          coverage: {
            percentage: allRoutes.length > 0 ? Math.round((coveredRoutes.length / allRoutes.length) * 100) : 0,
            covered: coveredRoutes.length,
            uncovered: uncoveredRoutes.length,
            total: allRoutes.length,
          },
          uncoveredBySegment: Object.fromEntries(uncoveredBySegment),
          uncoveredRoutes: uncoveredRoutes.map(r => r.route),
          routeCoverage,
        });
      } catch (error) {
        console.error('[Admin Systems Coverage API] Error:', error);
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
