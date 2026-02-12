/**
 * System Analyzer
 * 
 * Analyzes systems to find all related routes, files, components, services, etc.
 * Provides comprehensive information about each system for admin control.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';

export interface SystemFileInfo {
  type: 'page' | 'component' | 'service' | 'api' | 'hook' | 'type' | 'util' | 'other';
  path: string;
  route?: string; // For page files
}

export interface SystemRouteInfo {
  route: string;
  filePath: string;
  components: string[];
  services: string[];
  apiRoutes: string[];
  hooks: string[];
  types: string[];
  utils: string[];
}

export interface SystemDetail {
  schema_name: string;
  system_name: string;
  primary_route: string;
  routes: SystemRouteInfo[];
  allFiles: SystemFileInfo[];
  components: string[];
  services: string[];
  apiRoutes: string[];
  hooks: string[];
  types: string[];
  utils: string[];
}

/**
 * Find all page routes under a system's primary route
 */
function findRoutesForSystem(primaryRoute: string, appDir: string): SystemRouteInfo[] {
  const routes: SystemRouteInfo[] = [];
  
  function scanDirectory(dir: string, baseDir: string, currentPath: string = '') {
    try {
      const entries = readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (entry.startsWith('.') || entry === 'node_modules' || entry === '.next') {
            continue;
          }
          
          const nextPath = currentPath ? `${currentPath}/${entry}` : entry;
          scanDirectory(fullPath, baseDir, nextPath);
        } else if (entry === 'page.tsx' || entry === 'page.ts') {
          const routePath = currentPath === '' ? '/' : `/${currentPath}`;
          
          // Check if this route belongs to the system
          if (routePath === primaryRoute || routePath.startsWith(primaryRoute + '/')) {
            const filePath = relative(process.cwd(), fullPath);
            routes.push({
              route: routePath,
              filePath,
              components: [],
              services: [],
              apiRoutes: [],
              hooks: [],
              types: [],
              utils: [],
            });
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  scanDirectory(appDir, appDir);
  return routes;
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

/**
 * Resolve import path to actual file
 */
function resolveImportPath(importPath: string, fromFile: string): string | null {
  if (importPath.startsWith('@/')) {
    const path = importPath.replace('@/', 'src/');
    const possibleExtensions = ['.tsx', '.ts', '/index.tsx', '/index.ts'];
    
    for (const ext of possibleExtensions) {
      const fullPath = join(process.cwd(), path + ext);
      if (existsSync(fullPath)) {
        return relative(process.cwd(), fullPath);
      }
    }
    
    const dirPath = join(process.cwd(), path);
    if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
      return relative(process.cwd(), dirPath);
    }
  }
  
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    const fromDir = dirname(fromFile);
    const resolved = join(process.cwd(), fromDir, importPath);
    const possibleExtensions = ['.tsx', '.ts', '/index.tsx', '/index.ts'];
    
    for (const ext of possibleExtensions) {
      const fullPath = resolved + ext;
      if (existsSync(fullPath)) {
        return relative(process.cwd(), fullPath);
      }
    }
    
    if (existsSync(resolved) && statSync(resolved).isDirectory()) {
      return relative(process.cwd(), resolved);
    }
  }
  
  return null;
}

/**
 * Categorize file by type
 */
function categorizeFile(filePath: string): SystemFileInfo['type'] {
  if (filePath.includes('/components/')) return 'component';
  if (filePath.includes('/services/')) return 'service';
  if (filePath.includes('/api/')) return 'api';
  if (filePath.includes('/types/')) return 'type';
  if (filePath.includes('/hooks/')) return 'hook';
  if (filePath.includes('/utils/') || filePath.includes('/lib/')) return 'util';
  if (filePath.includes('/app/') && (filePath.includes('/page.tsx') || filePath.includes('/page.ts'))) return 'page';
  return 'other';
}

/**
 * Find dependencies for a route
 */
function findRouteDependencies(routeInfo: SystemRouteInfo, visited: Set<string> = new Set(), depth: number = 0): void {
  if (depth > 3 || visited.has(routeInfo.filePath)) return;
  
  visited.add(routeInfo.filePath);
  
  const fullPath = join(process.cwd(), routeInfo.filePath);
  if (!existsSync(fullPath)) return;
  
  try {
    const content = readFileSync(fullPath, 'utf-8');
    const imports = extractImports(content);
    
    for (const importPath of imports) {
      const resolved = resolveImportPath(importPath, routeInfo.filePath);
      if (!resolved) continue;
      
      const category = categorizeFile(resolved);
      
      if (category === 'component') {
        if (!routeInfo.components.includes(resolved)) {
          routeInfo.components.push(resolved);
        }
      } else if (category === 'service') {
        if (!routeInfo.services.includes(resolved)) {
          routeInfo.services.push(resolved);
        }
      } else if (category === 'api') {
        if (!routeInfo.apiRoutes.includes(resolved)) {
          routeInfo.apiRoutes.push(resolved);
        }
      } else if (category === 'type') {
        if (!routeInfo.types.includes(resolved)) {
          routeInfo.types.push(resolved);
        }
      } else if (category === 'hook') {
        if (!routeInfo.hooks.includes(resolved)) {
          routeInfo.hooks.push(resolved);
        }
      } else if (category === 'util') {
        if (!routeInfo.utils.includes(resolved)) {
          routeInfo.utils.push(resolved);
        }
      }
      
      // Recursively find dependencies for components and services
      if ((category === 'component' || category === 'service') && depth < 2) {
        const depRoute: SystemRouteInfo = {
          route: '',
          filePath: resolved,
          components: [],
          services: [],
          apiRoutes: [],
          hooks: [],
          types: [],
          utils: [],
        };
        findRouteDependencies(depRoute, visited, depth + 1);
        
        // Merge dependencies
        depRoute.components.forEach(c => {
          if (!routeInfo.components.includes(c)) routeInfo.components.push(c);
        });
        depRoute.services.forEach(s => {
          if (!routeInfo.services.includes(s)) routeInfo.services.push(s);
        });
      }
    }
  } catch (error) {
    // Skip files that can't be read
  }
}

/** Recursively find route.ts files under a directory */
function findRouteFiles(dir: string, baseDir: string, results: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry.startsWith('.') || entry === 'node_modules' || entry === '.next') continue;
        findRouteFiles(fullPath, baseDir, results);
      } else if (entry === 'route.ts') {
        results.push(relative(process.cwd(), fullPath));
      }
    }
  } catch {
    /* skip */
  }
  return results;
}

/**
 * Find API routes related to a system
 */
function findApiRoutesForSystem(schemaName: string, appDir: string): string[] {
  const apiRoutes: string[] = [];
  const apiDir = join(appDir, 'api');
  
  if (!existsSync(apiDir)) return apiRoutes;
  
  function scanApiDir(dir: string) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          if (entry === schemaName || entry.toLowerCase().includes(schemaName.toLowerCase())) {
            const routeFiles = findRouteFiles(fullPath, fullPath);
            routeFiles.forEach(file => {
              if (!apiRoutes.includes(file)) apiRoutes.push(file);
            });
          }
          scanApiDir(fullPath);
        }
      }
    } catch {
      /* skip */
    }
  }
  scanApiDir(apiDir);
  return apiRoutes;
}

/**
 * Analyze a system and return comprehensive details
 */
export function analyzeSystem(
  schemaName: string,
  systemName: string,
  primaryRoute: string
): SystemDetail {
  const appDir = join(process.cwd(), 'src/app');
  
  // Find all routes for this system
  const routes = findRoutesForSystem(primaryRoute, appDir);
  
  // Analyze dependencies for each route
  const visited = new Set<string>();
  routes.forEach(route => {
    findRouteDependencies(route, visited);
  });
  
  // Find API routes
  const apiRoutes = findApiRoutesForSystem(schemaName, appDir);
  
  // Collect all unique files
  const allFilesMap = new Map<string, SystemFileInfo>();
  
  routes.forEach(route => {
    // Add route file
    allFilesMap.set(route.filePath, {
      type: 'page',
      path: route.filePath,
      route: route.route,
    });
    
    // Add components
    route.components.forEach(c => {
      if (!allFilesMap.has(c)) {
        allFilesMap.set(c, { type: 'component', path: c });
      }
    });
    
    // Add services
    route.services.forEach(s => {
      if (!allFilesMap.has(s)) {
        allFilesMap.set(s, { type: 'service', path: s });
      }
    });
    
    // Add hooks
    route.hooks.forEach(h => {
      if (!allFilesMap.has(h)) {
        allFilesMap.set(h, { type: 'hook', path: h });
      }
    });
    
    // Add types
    route.types.forEach(t => {
      if (!allFilesMap.has(t)) {
        allFilesMap.set(t, { type: 'type', path: t });
      }
    });
    
    // Add utils
    route.utils.forEach(u => {
      if (!allFilesMap.has(u)) {
        allFilesMap.set(u, { type: 'util', path: u });
      }
    });
  });
  
  // Add API routes
  apiRoutes.forEach(api => {
    allFilesMap.set(api, { type: 'api', path: api });
  });
  
  // Collect unique items across all routes
  const allComponents = new Set<string>();
  const allServices = new Set<string>();
  const allHooks = new Set<string>();
  const allTypes = new Set<string>();
  const allUtils = new Set<string>();
  
  routes.forEach(route => {
    route.components.forEach(c => allComponents.add(c));
    route.services.forEach(s => allServices.add(s));
    route.hooks.forEach(h => allHooks.add(h));
    route.types.forEach(t => allTypes.add(t));
    route.utils.forEach(u => allUtils.add(u));
  });
  
  return {
    schema_name: schemaName,
    system_name: systemName,
    primary_route: primaryRoute,
    routes: routes.sort((a, b) => a.route.localeCompare(b.route)),
    allFiles: Array.from(allFilesMap.values()).sort((a, b) => a.path.localeCompare(b.path)),
    components: Array.from(allComponents).sort(),
    services: Array.from(allServices).sort(),
    apiRoutes: apiRoutes.sort(),
    hooks: Array.from(allHooks).sort(),
    types: Array.from(allTypes).sort(),
    utils: Array.from(allUtils).sort(),
  };
}
