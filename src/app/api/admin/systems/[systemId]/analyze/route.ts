import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

interface SystemAnalysis {
  system: {
    id: string;
    schema_name: string;
    system_name: string;
    primary_route: string;
  };
  routes: RouteInfo[];
  databaseTables: string[];
  apiRoutes: string[];
  files: {
    components: string[];
    services: string[];
    hooks: string[];
    types: string[];
    utils: string[];
    pages: string[];
  };
  totalFiles: number;
}

interface RouteInfo {
  path: string;
  filePath: string;
  hasMetadata: boolean;
  isDraft: boolean;
  components: string[];
  services: string[];
}

/**
 * GET /api/admin/systems/[systemId]/analyze
 * Get comprehensive analysis of a system including routes, files, and dependencies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  console.log('[Analyze Route] GET handler called');
  return withSecurity(
    request,
    async (req) => {
      try {
        const { systemId } = await params;
        console.log('[Analyze Route] systemId:', systemId);
        const supabase = await createServerClientWithAuth(cookies());
        
        // Get system info using RPC (admin schema requires RPC)
        // Use enhanced query_table with all parameters to avoid overload conflict
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
          console.error('[Analyze Route] Error fetching systems:', systemsError);
          return NextResponse.json(
            { error: 'Failed to fetch system', details: systemsError.message },
            { status: 500 }
          );
        }
        
        // Extract data from RPC result format: [{ data: JSONB array, total_count: N }]
        const systemsResultRow = systemsResult && systemsResult[0];
        const systemsArray = systemsResultRow?.data || [];
        const systems = Array.isArray(systemsArray) ? systemsArray : [];
        
        const systemRow = systems.find((s: any) => s.id === systemId);
        if (!systemRow) {
          return NextResponse.json(
            { error: 'System not found' },
            { status: 404 }
          );
        }
        
        const system = {
          id: systemRow.id,
          schema_name: systemRow.schema_name,
          system_name: systemRow.system_name,
          primary_route: systemRow.primary_route,
        };
        
        // Try to load manually entered details using RPC
        // Use enhanced query_table with all parameters to avoid overload conflict
        const { data: detailsResult, error: detailsError } = await (supabase.rpc as any)('query_table', {
          p_schema_name: 'admin',
          p_table_name: 'system_details',
          p_limit: 1000,
          p_offset: 0,
          p_order_by: null,
          p_order_direction: 'ASC',
          p_search: null,
          p_filters: null,
        });
        
        let detailsRow = null;
        if (!detailsError && detailsResult) {
          const detailsResultRow = detailsResult && detailsResult[0];
          const detailsArray = detailsResultRow?.data || [];
          const parsedArray = Array.isArray(detailsArray) ? detailsArray : [];
          detailsRow = parsedArray.find((d: any) => d.system_id === systemId);
        }
        
        if (detailsError) {
          console.error('[Analyze Route] Error fetching details:', detailsError);
          // Continue with fallback to file scanning
        }
        
        let routes, databaseTables, apiRoutes, files;
        
        if (detailsRow) {
          // Use manually entered details
          console.log('[Analyze Route] Using stored details for system:', system.system_name);
          routes = detailsRow.routes || [];
          databaseTables = detailsRow.database_tables || [];
          apiRoutes = detailsRow.api_routes || [];
          files = detailsRow.files || { components: [], services: [], hooks: [], types: [], utils: [], pages: [] };
        } else {
          // Fallback to file scanning (may not work in production)
          console.log('[Analyze Route] Falling back to file scanning for system:', system.system_name);
          routes = findRoutesForSystem(system.primary_route);
          databaseTables = await getDatabaseTables(system.schema_name, supabase);
          apiRoutes = findApiRoutesForSystem(system.schema_name);
          files = analyzeSystemFiles(routes, system.schema_name);
        }
        
        const analysis: SystemAnalysis = {
          system,
          routes,
          databaseTables,
          apiRoutes,
          files,
          totalFiles: 
            files.components.length +
            files.services.length +
            files.hooks.length +
            files.types.length +
            files.utils.length +
            files.pages.length,
        };
        
        return NextResponse.json(analysis);
      } catch (error) {
        console.error('[Admin Systems Analyze API] Error:', error);
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
 * Find all page routes for a system
 */
function findRoutesForSystem(primaryRoute: string): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const appDir = join(process.cwd(), 'src/app');
  
  // Check if directory exists (may not in production/serverless)
  if (!existsSync(appDir)) {
    console.warn('[System Analyze] src/app directory not found, returning empty routes');
    return [];
  }
  
  function scanDirectory(dir: string, currentPath: string = '') {
    try {
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (entry.startsWith('.') || entry === 'node_modules' || entry === '.next' || entry === 'api') {
            continue;
          }
          const nextPath = currentPath ? `${currentPath}/${entry}` : entry;
          scanDirectory(fullPath, nextPath);
        } else if (entry === 'page.tsx' || entry === 'page.ts') {
          const routePath = currentPath === '' ? '/' : `/${currentPath}`;
          
          // Check if route belongs to system
          if (routePath === primaryRoute || routePath.startsWith(primaryRoute + '/')) {
            const filePath = relative(process.cwd(), fullPath);
            const content = readFileSync(fullPath, 'utf-8');
            const hasMetadata = /export\s+(const|let)\s+metadata\s*[:=]/.test(content) ||
                              /export\s+(async\s+)?function\s+generateMetadata/.test(content);
            const isDraft = content.includes('generateDraftMetadata');
            
            // Extract basic imports
            const imports = extractImports(content);
            const components = imports.filter(i => i.includes('/components/'));
            const services = imports.filter(i => i.includes('/services/'));
            
            routes.push({
              path: routePath,
              filePath,
              hasMetadata,
              isDraft,
              components: components.slice(0, 10), // Limit for performance
              services: services.slice(0, 10),
            });
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  scanDirectory(appDir);
  return routes;
}

/**
 * Get database tables for a schema
 */
async function getDatabaseTables(schemaName: string, supabase: any): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('get_schemas_and_tables');
    if (error || !data) return [];
    
    return data
      .filter((row: any) => row.schema_name === schemaName)
      .map((row: any) => row.table_name)
      .sort();
  } catch (error) {
    console.error('Error fetching database tables:', error);
    return [];
  }
}

/**
 * Find API routes for a system
 */
function findApiRoutesForSystem(schemaName: string): string[] {
  const apiRoutes: string[] = [];
  const apiDir = join(process.cwd(), 'src/app/api');
  
  // May not exist in production/serverless
  if (!existsSync(apiDir)) {
    console.warn('[System Analyze] src/app/api directory not found');
    return apiRoutes;
  }
  
  function scanApiDirectory(dir: string, baseDir: string) {
    try {
      const entries = readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Check if directory name matches schema
          if (entry === schemaName || entry.toLowerCase().includes(schemaName.toLowerCase())) {
            // Find route.ts files in this directory tree
            findRouteFiles(fullPath, apiRoutes);
          }
          scanApiDirectory(fullPath, baseDir);
        } else if (entry === 'route.ts' || entry === 'route.tsx') {
          // Check if file references the schema
          try {
            const content = readFileSync(fullPath, 'utf-8');
            if (content.includes(schemaName) || content.includes(`schema('${schemaName}')`)) {
              const relPath = relative(process.cwd(), fullPath);
              if (!apiRoutes.includes(relPath)) {
                apiRoutes.push(relPath);
              }
            }
          } catch (error) {
            // Skip files that can't be read
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  function findRouteFiles(dir: string, routes: string[]) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          findRouteFiles(fullPath, routes);
        } else if (entry === 'route.ts' || entry === 'route.tsx') {
          const relPath = relative(process.cwd(), fullPath);
          if (!routes.includes(relPath)) {
            routes.push(relPath);
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  scanApiDirectory(apiDir, apiDir);
  return apiRoutes.sort();
}

/**
 * Analyze system files
 */
function analyzeSystemFiles(routes: RouteInfo[], schemaName: string): SystemAnalysis['files'] {
  const components = new Set<string>();
  const services = new Set<string>();
  const hooks = new Set<string>();
  const types = new Set<string>();
  const utils = new Set<string>();
  const pages = new Set<string>();
  
  // Collect from routes
  routes.forEach(route => {
    pages.add(route.filePath);
    route.components.forEach(c => components.add(c));
    route.services.forEach(s => services.add(s));
  });
  
  // Find files in schema-related directories
  const srcDir = join(process.cwd(), 'src');
  
  function scanForSchemaFiles(dir: string, baseDir: string) {
    try {
      const entries = readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (entry.startsWith('.') || entry === 'node_modules' || entry === '.next') {
            continue;
          }
          scanForSchemaFiles(fullPath, baseDir);
        } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
          const relPath = relative(process.cwd(), fullPath);
          const lowerPath = relPath.toLowerCase();
          const lowerEntry = entry.toLowerCase();
          
          // Check if file is related to schema
          if (
            lowerPath.includes(schemaName.toLowerCase()) ||
            lowerEntry.includes(schemaName.toLowerCase()) ||
            lowerPath.includes(`/features/${schemaName}/`) ||
            lowerPath.includes(`/components/${schemaName}/`) ||
            lowerPath.includes(`/services/${schemaName}/`)
          ) {
            if (lowerPath.includes('/components/')) components.add(relPath);
            else if (lowerPath.includes('/services/')) services.add(relPath);
            else if (lowerPath.includes('/hooks/')) hooks.add(relPath);
            else if (lowerPath.includes('/types/')) types.add(relPath);
            else if (lowerPath.includes('/utils/') || lowerPath.includes('/lib/')) utils.add(relPath);
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  // Check if src directory exists (may not in production/serverless)
  if (!existsSync(srcDir)) {
    console.warn('[System Analyze] src directory not found, returning empty files');
    return {
      components: [],
      services: [],
      hooks: [],
      types: [],
      utils: [],
      pages: [],
    };
  }
  
  // Scan features directory
  const featuresDir = join(srcDir, 'features', schemaName);
  if (existsSync(featuresDir)) {
    scanForSchemaFiles(featuresDir, featuresDir);
  }
  
  // Scan components directory
  const componentsDir = join(srcDir, 'components');
  if (existsSync(componentsDir)) {
    scanForSchemaFiles(componentsDir, componentsDir);
  }
  
  // Scan services directory
  const servicesDir = join(srcDir, 'features', schemaName, 'services');
  if (existsSync(servicesDir)) {
    scanForSchemaFiles(servicesDir, servicesDir);
  }
  
  return {
    components: Array.from(components).sort(),
    services: Array.from(services).sort(),
    hooks: Array.from(hooks).sort(),
    types: Array.from(types).sort(),
    utils: Array.from(utils).sort(),
    pages: Array.from(pages).sort(),
  };
}

/**
 * Extract imports from file content
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('@/') || importPath.startsWith('./') || importPath.startsWith('../')) {
      imports.push(importPath);
    }
  }
  
  return imports;
}
