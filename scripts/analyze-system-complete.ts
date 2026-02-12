#!/usr/bin/env tsx
/**
 * Complete System Analyzer
 * 
 * Analyzes a system comprehensively to populate admin.system_details
 * Usage: tsx scripts/analyze-system-complete.ts maps
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { glob } from 'glob';

interface SystemAnalysis {
  routes: Array<{
    path: string;
    filePath: string;
    hasMetadata: boolean;
    isDraft: boolean;
  }>;
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
}

function analyzeSystem(schemaName: string, primaryRoute: string): SystemAnalysis {
  const routes: SystemAnalysis['routes'] = [];
  const apiRoutes: string[] = [];
  const databaseTables: string[] = [];
  const files = {
    components: new Set<string>(),
    services: new Set<string>(),
    hooks: new Set<string>(),
    types: new Set<string>(),
    utils: new Set<string>(),
    pages: new Set<string>(),
  };

  // Find page routes
  const appDir = join(process.cwd(), 'src/app');
  if (existsSync(appDir)) {
    function scanRoutes(dir: string, currentPath: string = '') {
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules' && entry !== '.next' && entry !== 'api') {
            const nextPath = currentPath ? `${currentPath}/${entry}` : entry;
            scanRoutes(fullPath, nextPath);
          } else if (entry === 'page.tsx' || entry === 'page.ts') {
            const routePath = currentPath === '' ? '/' : `/${currentPath}`;
            if (routePath === primaryRoute || routePath.startsWith(primaryRoute + '/')) {
              const filePath = relative(process.cwd(), fullPath);
              const content = readFileSync(fullPath, 'utf-8');
              const hasMetadata = /export\s+(const|let)\s+metadata\s*[:=]/.test(content) ||
                                /export\s+(async\s+)?function\s+generateMetadata/.test(content);
              const isDraft = content.includes('generateDraftMetadata');
              
              routes.push({ path: routePath, filePath, hasMetadata, isDraft });
              files.pages.add(filePath);
            }
          }
        }
      } catch (error) {
        // Skip
      }
    }
    scanRoutes(appDir);
  }

  // Find API routes
  const apiDir = join(process.cwd(), 'src/app/api');
  if (existsSync(apiDir)) {
    function scanApi(dir: string) {
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            if (entry === schemaName || entry.toLowerCase().includes(schemaName.toLowerCase())) {
              const routeFiles = glob.sync('**/route.ts', { cwd: fullPath });
              routeFiles.forEach(file => {
                apiRoutes.push(relative(process.cwd(), join(fullPath, file)));
              });
            }
            scanApi(fullPath);
          } else if (entry === 'route.ts' || entry === 'route.tsx') {
            try {
              const content = readFileSync(fullPath, 'utf-8');
              if (content.includes(schemaName) || content.includes(`schema('${schemaName}')`)) {
                const relPath = relative(process.cwd(), fullPath);
                if (!apiRoutes.includes(relPath)) {
                  apiRoutes.push(relPath);
                }
              }
            } catch (error) {
              // Skip
            }
          }
        }
      } catch (error) {
        // Skip
      }
    }
    scanApi(apiDir);
  }

  // Find related files
  const srcDir = join(process.cwd(), 'src');
  if (existsSync(srcDir)) {
    const patterns = [
      `**/features/${schemaName}/**/*.{ts,tsx}`,
      `**/components/**/*${schemaName}*.{ts,tsx}`,
      `**/services/**/*${schemaName}*.{ts,tsx}`,
    ];
    
    patterns.forEach(pattern => {
      try {
        const foundFiles = glob.sync(pattern, { cwd: srcDir });
        foundFiles.forEach(file => {
          const fullPath = relative(process.cwd(), join(srcDir, file));
          if (fullPath.includes('/components/')) files.components.add(fullPath);
          else if (fullPath.includes('/services/')) files.services.add(fullPath);
          else if (fullPath.includes('/hooks/')) files.hooks.add(fullPath);
          else if (fullPath.includes('/types/')) files.types.add(fullPath);
          else if (fullPath.includes('/utils/') || fullPath.includes('/lib/')) files.utils.add(fullPath);
        });
      } catch (error) {
        // Skip
      }
    });
  }

  return {
    routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
    databaseTables: databaseTables.sort(),
    apiRoutes: apiRoutes.sort(),
    files: {
      components: Array.from(files.components).sort(),
      services: Array.from(files.services).sort(),
      hooks: Array.from(files.hooks).sort(),
      types: Array.from(files.types).sort(),
      utils: Array.from(files.utils).sort(),
      pages: Array.from(files.pages).sort(),
    },
  };
}

// Main
const schemaName = process.argv[2];
if (!schemaName) {
  console.error('Usage: tsx scripts/analyze-system-complete.ts <schema_name>');
  process.exit(1);
}

// Get primary route from database or use default
const primaryRoute = process.argv[3] || `/${schemaName}`;

console.log(`\nAnalyzing system: ${schemaName} (primary route: ${primaryRoute})\n`);
const analysis = analyzeSystem(schemaName, primaryRoute);

console.log('=== ROUTES ===');
analysis.routes.forEach(r => {
  console.log(`${r.path} -> ${r.filePath} ${r.hasMetadata ? '[metadata]' : ''} ${r.isDraft ? '[draft]' : ''}`);
});

console.log(`\n=== API ROUTES (${analysis.apiRoutes.length}) ===`);
analysis.apiRoutes.forEach(r => console.log(r));

console.log(`\n=== DATABASE TABLES ===`);
console.log('(Query from database)');

console.log(`\n=== FILES ===`);
console.log(`Components: ${analysis.files.components.length}`);
console.log(`Services: ${analysis.files.services.length}`);
console.log(`Hooks: ${analysis.files.hooks.length}`);
console.log(`Types: ${analysis.files.types.length}`);
console.log(`Utils: ${analysis.files.utils.length}`);
console.log(`Pages: ${analysis.files.pages.length}`);

// Output JSON for easy copy-paste
console.log('\n=== JSON OUTPUT (for admin UI) ===');
console.log(JSON.stringify(analysis, null, 2));
