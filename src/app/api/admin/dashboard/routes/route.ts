import { NextRequest, NextResponse } from 'next/server';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { withSecurity } from '@/lib/security/middleware';
import { isDraftRoute, DRAFT_ROUTES } from '@/lib/routes/draft-pages';

interface RouteInfo {
  path: string;
  filePath: string;
  hasMetadata: boolean;
  hasGenerateMetadata: boolean;
  metadataType: 'static' | 'dynamic' | 'none';
  routePattern: string;
  segments: string[];
  isDynamic: boolean;
  isCatchAll: boolean;
  isOptionalCatchAll: boolean;
  isDraft: boolean;
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string[];
    robots?: any;
    openGraph?: any;
    twitter?: any;
  };
}

interface RouteGroup {
  path: string;
  primarySegment: string;
  routes: RouteInfo[];
  subGroups: RouteGroup[];
  hasMetadata: boolean;
  metadataType: 'static' | 'dynamic' | 'none';
  isDynamic: boolean;
}

/**
 * Recursively scan app directory for page.tsx files
 */
function scanAppDirectory(dir: string, baseDir: string, routes: RouteInfo[] = []): RouteInfo[] {
  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules, .next, and other build directories
        if (
          entry.startsWith('.') ||
          entry === 'node_modules' ||
          entry === '.next'
        ) {
          continue;
        }
        // Skip api subdirectories (API routes, not page routes)
        const relativeDir = relative(baseDir, dir);
        if (relativeDir.split('/').includes('api')) {
          continue;
        }
        scanAppDirectory(fullPath, baseDir, routes);
      } else if (entry === 'page.tsx' || entry === 'page.ts') {
        const relativePath = relative(baseDir, dir);
        const routePath = relativePath === '' ? '/' : `/${relativePath}`;
        
        // Convert file path to route pattern
        const routePattern = convertPathToRoutePattern(routePath);
        
        // Read file content to check for metadata
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const hasMetadata = /export\s+(const|let)\s+metadata\s*[:=]/.test(content);
          const hasGenerateMetadata = /export\s+(async\s+)?function\s+generateMetadata/.test(content);
          
          // Extract metadata if static
          let metadata: RouteInfo['metadata'] | undefined;
          if (hasMetadata) {
            metadata = extractStaticMetadata(content);
          }

          const isDraft = isDraftRoute(routePath);
          
          routes.push({
            path: routePath,
            filePath: relative(process.cwd(), fullPath),
            hasMetadata,
            hasGenerateMetadata,
            metadataType: hasMetadata ? 'static' : hasGenerateMetadata ? 'dynamic' : 'none',
            routePattern,
            segments: routePath.split('/').filter(Boolean),
            isDynamic: routePath.includes('['),
            isCatchAll: routePath.includes('[...'),
            isOptionalCatchAll: routePath.includes('[[...'),
            isDraft,
            metadata,
          });
        } catch (error) {
          // Skip files that can't be read
          console.warn(`Could not read ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn(`Could not scan directory ${dir}:`, error);
  }

  return routes;
}

/**
 * Convert file path to route pattern
 */
function convertPathToRoutePattern(path: string): string {
  if (path === '/') return '/';
  
  return path
    .split('/')
    .map(segment => {
      if (segment.startsWith('[[...') && segment.endsWith(']]')) {
        return `*${segment.slice(5, -2)}`;
      }
      if (segment.startsWith('[...') && segment.endsWith(']')) {
        return `+${segment.slice(4, -1)}`;
      }
      if (segment.startsWith('[') && segment.endsWith(']')) {
        return `:${segment.slice(1, -1)}`;
      }
      return segment;
    })
    .join('/');
}

/**
 * Group routes hierarchically by primary segments
 */
function groupRoutesHierarchically(routes: RouteInfo[]): RouteGroup[] {
  const groups = new Map<string, RouteGroup>();
  
  for (const route of routes) {
    const segments = route.segments;
    
    if (segments.length === 0) {
      // Root route - create special group
      if (!groups.has('/')) {
        groups.set('/', {
          path: '/',
          primarySegment: '/',
          routes: [],
          subGroups: [],
          hasMetadata: route.hasMetadata || route.hasGenerateMetadata,
          metadataType: route.metadataType,
          isDynamic: route.isDynamic,
        });
      }
      groups.get('/')!.routes.push(route);
      continue;
    }
    
    // Get primary segment (first non-dynamic segment)
    const primarySegment = segments[0];
    const primaryPath = `/${primarySegment}`;
    
    // Create or get primary group
    if (!groups.has(primaryPath)) {
      groups.set(primaryPath, {
        path: primaryPath,
        primarySegment,
        routes: [],
        subGroups: [],
        hasMetadata: false,
        metadataType: 'none',
        isDynamic: primarySegment.startsWith(':') || primarySegment.startsWith('*') || primarySegment.startsWith('+'),
      });
    }
    
    const primaryGroup = groups.get(primaryPath)!;
    
    // Check if this route belongs to primary group or a sub-group
    if (segments.length === 1) {
      // Direct child of primary route
      primaryGroup.routes.push(route);
      if (route.hasMetadata || route.hasGenerateMetadata) {
        primaryGroup.hasMetadata = true;
        if (route.metadataType !== 'none') {
          primaryGroup.metadataType = route.metadataType;
        }
      }
    } else {
      // Belongs to a sub-group
      const subPath = `/${segments.slice(0, 2).join('/')}`;
      let subGroup = primaryGroup.subGroups.find(g => g.path === subPath);
      
      if (!subGroup) {
        subGroup = {
          path: subPath,
          primarySegment: segments[1],
          routes: [],
          subGroups: [],
          hasMetadata: false,
          metadataType: 'none',
          isDynamic: segments[1].startsWith(':') || segments[1].startsWith('*') || segments[1].startsWith('+'),
        };
        primaryGroup.subGroups.push(subGroup);
      }
      
      // If route has more segments, recursively add to deeper sub-groups
      if (segments.length > 2) {
        addToSubGroup(subGroup, route, segments.slice(2));
      } else {
        subGroup.routes.push(route);
        if (route.hasMetadata || route.hasGenerateMetadata) {
          subGroup.hasMetadata = true;
          if (route.metadataType !== 'none') {
            subGroup.metadataType = route.metadataType;
          }
        }
      }
    }
  }
  
  // Sort groups and sub-groups
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.path === '/') return -1;
    if (b.path === '/') return 1;
    return a.path.localeCompare(b.path);
  });
  
  // Sort sub-groups recursively
  sortedGroups.forEach(group => {
    group.subGroups.sort((a, b) => a.path.localeCompare(b.path));
    group.routes.sort((a, b) => a.path.localeCompare(b.path));
    sortSubGroupsRecursive(group.subGroups);
  });
  
  return sortedGroups;
}

/**
 * Recursively add route to nested sub-groups
 */
function addToSubGroup(group: RouteGroup, route: RouteInfo, remainingSegments: string[]): void {
  if (remainingSegments.length === 0) {
    group.routes.push(route);
    if (route.hasMetadata || route.hasGenerateMetadata) {
      group.hasMetadata = true;
      if (route.metadataType !== 'none') {
        group.metadataType = route.metadataType;
      }
    }
    return;
  }
  
  const nextSegment = remainingSegments[0];
  const nextPath = `${group.path}/${nextSegment}`;
  
  let nextSubGroup = group.subGroups.find(g => g.path === nextPath);
  if (!nextSubGroup) {
    nextSubGroup = {
      path: nextPath,
      primarySegment: nextSegment,
      routes: [],
      subGroups: [],
      hasMetadata: false,
      metadataType: 'none',
      isDynamic: nextSegment.startsWith(':') || nextSegment.startsWith('*') || nextSegment.startsWith('+'),
    };
    group.subGroups.push(nextSubGroup);
  }
  
  addToSubGroup(nextSubGroup, route, remainingSegments.slice(1));
}

/**
 * Recursively sort sub-groups
 */
function sortSubGroupsRecursive(subGroups: RouteGroup[]): void {
  subGroups.forEach(group => {
    group.subGroups.sort((a, b) => a.path.localeCompare(b.path));
    group.routes.sort((a, b) => a.path.localeCompare(b.path));
    sortSubGroupsRecursive(group.subGroups);
  });
}

/**
 * Extract static metadata from file content (basic parsing)
 */
function extractStaticMetadata(content: string): RouteInfo['metadata'] {
  const metadata: RouteInfo['metadata'] = {};
  
  // Extract title
  const titleMatch = content.match(/title:\s*['"`]([^'"`]+)['"`]/);
  if (titleMatch) {
    metadata.title = titleMatch[1];
  }
  
  // Extract description
  const descMatch = content.match(/description:\s*['"`]([^'"`]+)['"`]/);
  if (descMatch) {
    metadata.description = descMatch[1];
  }
  
  // Extract keywords (array)
  const keywordsMatch = content.match(/keywords:\s*\[([^\]]+)\]/);
  if (keywordsMatch) {
    metadata.keywords = keywordsMatch[1]
      .split(',')
      .map(k => k.trim().replace(/['"`]/g, ''));
  }
  
  // Check for robots config
  if (content.includes('robots:')) {
    metadata.robots = { configured: true };
  }
  
  // Check for OpenGraph
  if (content.includes('openGraph:')) {
    metadata.openGraph = { configured: true };
  }
  
  // Check for Twitter
  if (content.includes('twitter:')) {
    metadata.twitter = { configured: true };
  }
  
  return metadata;
}

/**
 * GET /api/admin/dashboard/routes
 * Admin-only endpoint to scan and return all routes with SEO metadata
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const appDir = join(process.cwd(), 'src/app');
        const routes = scanAppDirectory(appDir, appDir);
        
        // Sort routes by path
        routes.sort((a, b) => {
          // Static routes first, then dynamic
          if (a.isDynamic !== b.isDynamic) {
            return a.isDynamic ? 1 : -1;
          }
          return a.path.localeCompare(b.path);
        });
        
        // Group routes hierarchically
        const groupedRoutes = groupRoutesHierarchically(routes);
        
        // Calculate statistics
        const draftRoutes = routes.filter(r => r.isDraft);
        const productionRoutes = routes.filter(r => !r.isDraft);
        
        const stats = {
          total: routes.length,
          withMetadata: routes.filter(r => r.hasMetadata || r.hasGenerateMetadata).length,
          staticMetadata: routes.filter(r => r.hasMetadata).length,
          dynamicMetadata: routes.filter(r => r.hasGenerateMetadata).length,
          noMetadata: routes.filter(r => !r.hasMetadata && !r.hasGenerateMetadata).length,
          dynamicRoutes: routes.filter(r => r.isDynamic).length,
          catchAllRoutes: routes.filter(r => r.isCatchAll || r.isOptionalCatchAll).length,
          draftRoutes: draftRoutes.length,
          productionRoutes: productionRoutes.length,
        };
        
        return NextResponse.json({
          routes,
          groupedRoutes,
          stats,
        });
      } catch (error) {
        console.error('[Admin Routes API] Error:', error);
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
