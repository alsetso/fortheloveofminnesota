#!/usr/bin/env tsx
/**
 * Mark Routes Without Metadata as Draft
 * 
 * Scans all page routes and identifies those without metadata.
 * Adds them to DRAFT_ROUTES and updates their page.tsx files.
 * 
 * Usage:
 *   tsx scripts/mark-routes-without-metadata-as-draft.ts --dry-run
 *   tsx scripts/mark-routes-without-metadata-as-draft.ts --apply
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

interface RouteInfo {
  path: string;
  filePath: string;
  hasMetadata: boolean;
  hasGenerateMetadata: boolean;
  needsDraftMetadata: boolean;
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
        
        // Read file content to check for metadata
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const hasMetadata = /export\s+(const|let)\s+metadata\s*[:=]/.test(content);
          const hasGenerateMetadata = /export\s+(async\s+)?function\s+generateMetadata/.test(content);
          
          // Check if already using generateDraftMetadata
          const hasDraftMetadata = /generateDraftMetadata/.test(content);
          
          routes.push({
            path: routePath,
            filePath: relative(process.cwd(), fullPath),
            hasMetadata,
            hasGenerateMetadata,
            needsDraftMetadata: !hasMetadata && !hasGenerateMetadata && !hasDraftMetadata,
          });
        } catch (error) {
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
 * Read current DRAFT_ROUTES from draft-pages.ts
 */
function getCurrentDraftRoutes(): string[] {
  const draftPagesPath = join(process.cwd(), 'src/lib/routes/draft-pages.ts');
  if (!existsSync(draftPagesPath)) {
    return [];
  }
  
  const content = readFileSync(draftPagesPath, 'utf-8');
  const match = content.match(/export\s+const\s+DRAFT_ROUTES\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
  
  if (!match) return [];
  
  const routes = match[1]
    .split(',')
    .map(r => r.trim().replace(/['"`]/g, '').replace(/\/\/.*$/, '').trim())
    .filter(Boolean);
  
  return routes;
}

/**
 * Update DRAFT_ROUTES array
 */
function updateDraftRoutes(newRoutes: string[], dryRun: boolean): void {
  const draftPagesPath = join(process.cwd(), 'src/lib/routes/draft-pages.ts');
  const content = readFileSync(draftPagesPath, 'utf-8');
  
  // Sort routes for consistency
  const allRoutes = [...new Set([...getCurrentDraftRoutes(), ...newRoutes])].sort();
  
  // Format routes array
  const routesArray = allRoutes
    .map(route => `  '${route}',`)
    .join('\n');
  
  const newContent = content.replace(
    /export\s+const\s+DRAFT_ROUTES\s*=\s*\[[\s\S]*?\]\s*as\s+const/,
    `export const DRAFT_ROUTES = [\n${routesArray}\n] as const`
  );
  
  if (dryRun) {
    console.log('\n📝 Would update DRAFT_ROUTES to:');
    console.log(newContent.match(/export\s+const\s+DRAFT_ROUTES\s*=\s*\[[\s\S]*?\]\s*as\s+const/)?.[0] || '');
  } else {
    writeFileSync(draftPagesPath, newContent, 'utf-8');
    console.log(`✅ Updated ${draftPagesPath}`);
  }
}

/**
 * Add draft metadata to page file
 */
function addDraftMetadataToPage(filePath: string, routePath: string, dryRun: boolean): boolean {
  const fullPath = join(process.cwd(), filePath);
  if (!existsSync(fullPath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return false;
  }
  
  let content = readFileSync(fullPath, 'utf-8');
  
  // Check if already has draft metadata
  if (content.includes('generateDraftMetadata')) {
    console.log(`   ℹ️  Already has draft metadata: ${filePath}`);
    return false;
  }
  
  // Generate route name for title
  const routeName = routePath === '/' 
    ? 'Home' 
    : routePath.split('/').filter(Boolean).pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Page';
  
  // Check if file has any imports from metadata utils
  const hasMetadataImport = content.includes("from '@/lib/utils/metadata'") || 
                           content.includes('from "@/lib/utils/metadata"');
  
  // Add import if needed
  if (!hasMetadataImport) {
    // Find the last import statement
    const importRegex = /^import\s+.*$/gm;
    const imports = content.match(importRegex) || [];
    
    if (imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertIndex = lastImportIndex + lastImport.length;
      
      content = content.slice(0, insertIndex) + 
                "\nimport { generateDraftMetadata } from '@/lib/utils/metadata';" +
                content.slice(insertIndex);
    } else {
      // No imports, add at top
      content = "import { generateDraftMetadata } from '@/lib/utils/metadata';\n" + content;
    }
  }
  
  // Add metadata export
  // Check if there's already a metadata export (shouldn't be, but check anyway)
  if (!content.includes('export const metadata') && !content.includes('export async function generateMetadata')) {
    // Find the best insertion point - after imports, before any exports
    const lines = content.split('\n');
    let insertIndex = 0;
    let lastImportIndex = -1;
    let firstExportIndex = -1;
    
    // Find last import and first export
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s+/.test(lines[i])) {
        lastImportIndex = i;
      }
      if (/^export\s+/.test(lines[i]) && firstExportIndex === -1) {
        firstExportIndex = i;
      }
    }
    
    // Insert after last import, or before first export, or at end
    if (lastImportIndex >= 0) {
      insertIndex = lastImportIndex + 1;
    } else if (firstExportIndex >= 0) {
      insertIndex = firstExportIndex;
    } else {
      insertIndex = lines.length;
    }
    
    const metadataExport = `export const metadata = generateDraftMetadata({\n  title: '${routeName} (Draft)',\n  description: 'This page is under development.',\n});\n`;
    
    lines.splice(insertIndex, 0, '', metadataExport);
    content = lines.join('\n');
  }
  
  if (dryRun) {
    console.log(`   📝 Would add draft metadata to: ${filePath}`);
    return false;
  } else {
    writeFileSync(fullPath, content, 'utf-8');
    console.log(`   ✅ Added draft metadata to: ${filePath}`);
    return true;
  }
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || (!args.includes('--apply') && !args.includes('--dry-run'));
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  } else {
    console.log('🚀 APPLY MODE - Files will be modified\n');
  }
  
  console.log('Scanning routes...\n');
  
  const appDir = join(process.cwd(), 'src/app');
  const routes = scanAppDirectory(appDir, appDir);
  
  // Filter routes without metadata
  const routesWithoutMetadata = routes.filter(r => r.needsDraftMetadata);
  
  console.log(`📊 Found ${routes.length} total routes`);
  console.log(`📋 Found ${routesWithoutMetadata.length} routes without metadata\n`);
  
  if (routesWithoutMetadata.length === 0) {
    console.log('✅ All routes have metadata!');
    return;
  }
  
  console.log('Routes without metadata:');
  routesWithoutMetadata.forEach(r => {
    console.log(`  - ${r.path} (${r.filePath})`);
  });
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Update draft routes
  const routesToAdd = routesWithoutMetadata.map(r => r.path);
  updateDraftRoutes(routesToAdd, dryRun);
  
  console.log('\nUpdating page files...\n');
  
  let updatedCount = 0;
  for (const route of routesWithoutMetadata) {
    if (addDraftMetadataToPage(route.filePath, route.path, dryRun)) {
      updatedCount++;
    }
  }
  
  console.log(`\n${dryRun ? 'Would update' : 'Updated'} ${updatedCount} page files`);
  
  if (dryRun) {
    console.log('\n💡 Run with --apply to make changes');
  } else {
    console.log('\n✅ Done! Routes marked as draft.');
    console.log('\nNext steps:');
    console.log('  1. Review the changes');
    console.log('  2. Test routes in development');
    console.log('  3. Commit changes');
  }
}

if (require.main === module) {
  main();
}

export { scanAppDirectory, getCurrentDraftRoutes };
