#!/usr/bin/env tsx
/**
 * Route Dependency Identifier
 * 
 * Identifies all files (components, services, API routes, types) related to a specific route.
 * Useful for marking routes as draft and understanding what needs to be kept unpublished.
 * 
 * Usage:
 *   tsx scripts/identify-route-dependencies.ts /marketplace
 *   tsx scripts/identify-route-dependencies.ts /feed
 *   tsx scripts/identify-route-dependencies.ts /stories
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';

interface RouteDependencies {
  route: string;
  pageFile: string | null;
  components: string[];
  services: string[];
  apiRoutes: string[];
  types: string[];
  hooks: string[];
  utils: string[];
  relatedRoutes: string[];
}

/**
 * Convert route path to file path pattern
 */
function routeToFilePattern(route: string): string {
  if (route === '/') return 'src/app/page.tsx';
  
  const segments = route.split('/').filter(Boolean);
  const filePath = segments.map(seg => {
    // Handle dynamic segments
    if (seg.startsWith('[') && seg.endsWith(']')) {
      return seg; // Keep as [id] or [slug]
    }
    return seg;
  }).join('/');
  
  return `src/app/${filePath}/page.tsx`;
}

/**
 * Find page file for route
 */
function findPageFile(route: string): string | null {
  const pattern = routeToFilePattern(route);
  const fullPath = join(process.cwd(), pattern);
  
  if (existsSync(fullPath)) {
    return relative(process.cwd(), fullPath);
  }
  
  // Try with .ts extension
  const tsPath = fullPath.replace('.tsx', '.ts');
  if (existsSync(tsPath)) {
    return relative(process.cwd(), tsPath);
  }
  
  return null;
}

/**
 * Extract imports from file content
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  
  // Match import statements
  const importRegex = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    // Only include local imports (starting with @/ or ./)
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
  // Handle @/ aliases (assuming @/ maps to src/)
  if (importPath.startsWith('@/')) {
    const path = importPath.replace('@/', 'src/');
    const possibleExtensions = ['.tsx', '.ts', '/index.tsx', '/index.ts'];
    
    for (const ext of possibleExtensions) {
      const fullPath = join(process.cwd(), path + ext);
      if (existsSync(fullPath)) {
        return relative(process.cwd(), fullPath);
      }
    }
    
    // Try as directory with index
    const dirPath = join(process.cwd(), path);
    if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
      return relative(process.cwd(), dirPath);
    }
  }
  
  // Handle relative imports
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
    
    // Try as directory
    if (existsSync(resolved) && statSync(resolved).isDirectory()) {
      return relative(process.cwd(), resolved);
    }
  }
  
  return null;
}

/**
 * Categorize file by type
 */
function categorizeFile(filePath: string): 'component' | 'service' | 'api' | 'type' | 'hook' | 'util' | 'other' {
  if (filePath.includes('/components/')) return 'component';
  if (filePath.includes('/services/')) return 'service';
  if (filePath.includes('/api/')) return 'api';
  if (filePath.includes('/types/')) return 'type';
  if (filePath.includes('/hooks/')) return 'hook';
  if (filePath.includes('/utils/') || filePath.includes('/lib/')) return 'util';
  return 'other';
}

/**
 * Find all dependencies recursively
 */
function findDependencies(
  filePath: string,
  visited: Set<string> = new Set(),
  maxDepth: number = 5,
  depth: number = 0
): {
  components: Set<string>;
  services: Set<string>;
  apiRoutes: Set<string>;
  types: Set<string>;
  hooks: Set<string>;
  utils: Set<string>;
} {
  if (depth > maxDepth || visited.has(filePath)) {
    return {
      components: new Set(),
      services: new Set(),
      apiRoutes: new Set(),
      types: new Set(),
      hooks: new Set(),
      utils: new Set(),
    };
  }
  
  visited.add(filePath);
  
  const result = {
    components: new Set<string>(),
    services: new Set<string>(),
    apiRoutes: new Set<string>(),
    types: new Set<string>(),
    hooks: new Set<string>(),
    utils: new Set<string>(),
  };
  
  const fullPath = join(process.cwd(), filePath);
  if (!existsSync(fullPath)) return result;
  
  try {
    const content = readFileSync(fullPath, 'utf-8');
    const imports = extractImports(content);
    
    for (const importPath of imports) {
      const resolved = resolveImportPath(importPath, filePath);
      if (!resolved) continue;
      
      const category = categorizeFile(resolved);
      
      // Add to appropriate category
      if (category === 'component') result.components.add(resolved);
      else if (category === 'service') result.services.add(resolved);
      else if (category === 'api') result.apiRoutes.add(resolved);
      else if (category === 'type') result.types.add(resolved);
      else if (category === 'hook') result.hooks.add(resolved);
      else if (category === 'util') result.utils.add(resolved);
      
      // Recursively find dependencies (only for components and services)
      if (category === 'component' || category === 'service') {
        const deps = findDependencies(resolved, visited, maxDepth, depth + 1);
        deps.components.forEach(c => result.components.add(c));
        deps.services.forEach(s => result.services.add(s));
        deps.apiRoutes.forEach(a => result.apiRoutes.add(a));
        deps.types.forEach(t => result.types.add(t));
        deps.hooks.forEach(h => result.hooks.add(h));
        deps.utils.forEach(u => result.utils.add(u));
      }
    }
  } catch (error) {
    // Skip files that can't be read
  }
  
  return result;
}

/**
 * Recursively find files in directory matching pattern
 */
function findFilesInDir(dir: string, extensions: string[] = ['.ts', '.tsx'], maxDepth: number = 5, depth: number = 0): string[] {
  if (depth > maxDepth || !existsSync(dir)) return [];
  
  const files: string[] = [];
  
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules, .next, etc.
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        files.push(...findFilesInDir(fullPath, extensions, maxDepth, depth + 1));
      } else if (stat.isFile()) {
        const ext = entry.substring(entry.lastIndexOf('.'));
        if (extensions.includes(ext)) {
          files.push(relative(process.cwd(), fullPath));
        }
      }
    }
  } catch (error) {
    // Directory might not be readable
  }
  
  return files;
}

/**
 * Find related API routes based on route path
 */
function findRelatedApiRoutes(route: string): string[] {
  const segments = route.split('/').filter(Boolean);
  const apiRoutes: string[] = [];
  
  if (segments.length === 0) return apiRoutes;
  
  // Check for matching API routes
  const apiBaseDir = join(process.cwd(), 'src/app/api');
  
  // Check first segment
  const firstSegmentDir = join(apiBaseDir, segments[0]);
  if (existsSync(firstSegmentDir)) {
    apiRoutes.push(...findFilesInDir(firstSegmentDir));
  }
  
  // Check second segment if exists
  if (segments.length > 1) {
    const secondSegmentDir = join(firstSegmentDir, segments[1]);
    if (existsSync(secondSegmentDir)) {
      apiRoutes.push(...findFilesInDir(secondSegmentDir));
    }
  }
  
  return [...new Set(apiRoutes)];
}

/**
 * Find related routes (sibling routes in same directory)
 */
function findRelatedRoutes(route: string): string[] {
  const pageFile = findPageFile(route);
  if (!pageFile) return [];
  
  const routeDir = dirname(pageFile);
  const relatedRoutes: string[] = [];
  
  try {
    const entries = readdirSync(join(process.cwd(), routeDir));
    for (const entry of entries) {
      const fullPath = join(routeDir, entry);
      const stat = statSync(join(process.cwd(), fullPath));
      
      if (stat.isDirectory()) {
        const subPage = join(fullPath, 'page.tsx');
        if (existsSync(join(process.cwd(), subPage))) {
          // Convert back to route path
          const routePath = '/' + fullPath.replace('src/app/', '').replace('/page.tsx', '');
          if (routePath !== route) {
            relatedRoutes.push(routePath);
          }
        }
      }
    }
  } catch (error) {
    // Directory might not exist
  }
  
  return relatedRoutes;
}

/**
 * Main function
 */
function identifyRouteDependencies(route: string): RouteDependencies {
  const pageFile = findPageFile(route);
  
  if (!pageFile) {
    console.error(`❌ Page file not found for route: ${route}`);
    process.exit(1);
  }
  
  console.log(`📄 Analyzing route: ${route}`);
  console.log(`📁 Page file: ${pageFile}\n`);
  
  const deps = findDependencies(pageFile);
  const apiRoutes = findRelatedApiRoutes(route);
  const relatedRoutes = findRelatedRoutes(route);
  
  return {
    route,
    pageFile,
    components: Array.from(deps.components).sort(),
    services: Array.from(deps.services).sort(),
    apiRoutes: Array.from(new Set([...deps.apiRoutes, ...apiRoutes])).sort(),
    types: Array.from(deps.types).sort(),
    hooks: Array.from(deps.hooks).sort(),
    utils: Array.from(deps.utils).sort(),
    relatedRoutes: relatedRoutes.sort(),
  };
}

// CLI
if (require.main === module) {
  const route = process.argv[2];
  
  if (!route) {
    console.error('Usage: tsx scripts/identify-route-dependencies.ts <route>');
    console.error('Example: tsx scripts/identify-route-dependencies.ts /marketplace');
    process.exit(1);
  }
  
  const deps = identifyRouteDependencies(route);
  
  console.log('📦 DEPENDENCIES FOUND:\n');
  
  if (deps.components.length > 0) {
    console.log('🧩 Components:');
    deps.components.forEach(c => console.log(`   ${c}`));
    console.log();
  }
  
  if (deps.services.length > 0) {
    console.log('⚙️  Services:');
    deps.services.forEach(s => console.log(`   ${s}`));
    console.log();
  }
  
  if (deps.apiRoutes.length > 0) {
    console.log('🔌 API Routes:');
    deps.apiRoutes.forEach(a => console.log(`   ${a}`));
    console.log();
  }
  
  if (deps.hooks.length > 0) {
    console.log('🪝 Hooks:');
    deps.hooks.forEach(h => console.log(`   ${h}`));
    console.log();
  }
  
  if (deps.types.length > 0) {
    console.log('📝 Types:');
    deps.types.forEach(t => console.log(`   ${t}`));
    console.log();
  }
  
  if (deps.utils.length > 0) {
    console.log('🛠️  Utils:');
    deps.utils.forEach(u => console.log(`   ${u}`));
    console.log();
  }
  
  if (deps.relatedRoutes.length > 0) {
    console.log('🔗 Related Routes:');
    deps.relatedRoutes.forEach(r => console.log(`   ${r}`));
    console.log();
  }
  
  console.log('\n✅ Analysis complete!');
  console.log('\n💡 To mark this route as draft:');
  console.log(`   1. Add '${route}' to DRAFT_ROUTES in src/lib/routes/draft-pages.ts`);
  console.log(`   2. Update ${deps.pageFile} to use generateDraftMetadata()`);
  console.log(`   3. (Optional) Enable blockInProduction in DRAFT_CONFIG`);
}

export { identifyRouteDependencies };
