#!/usr/bin/env tsx
/**
 * Find Unused Files
 * 
 * Scans the codebase to find files that are not imported or referenced anywhere.
 * Usage: tsx scripts/find-unused-files.ts [--dry-run] [--exclude-archive]
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, extname, dirname } from 'path';

interface FileInfo {
  path: string;
  relativePath: string;
  imports: string[];
  exports: string[];
  isEntryPoint: boolean;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const excludeArchive = args.includes('--exclude-archive') || true; // Default to true

// Directories to skip
const SKIP_DIRS = [
  'node_modules',
  '.next',
  'out',
  'dist',
  'build',
  '.git',
  'supabase/functions',
  'scripts',
  ...(excludeArchive ? ['_archive', '*_archive'] : []),
];

// Files to always skip
const SKIP_FILES = [
  'next-env.d.ts',
  'tsconfig.json',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

// Entry points that are always used (Next.js routes, API routes, etc.)
const ENTRY_POINT_PATTERNS = [
  /^src\/app\/.*\/page\.tsx?$/, // Next.js pages
  /^src\/app\/.*\/layout\.tsx?$/, // Next.js layouts
  /^src\/app\/.*\/loading\.tsx?$/, // Next.js loading
  /^src\/app\/.*\/error\.tsx?$/, // Next.js error
  /^src\/app\/.*\/not-found\.tsx?$/, // Next.js not-found
  /^src\/app\/.*\/route\.tsx?$/, // API routes
  /^src\/middleware\.tsx?$/, // Middleware
  /^src\/app\/layout\.tsx?$/, // Root layout
  /^src\/app\/globals\.css$/, // Global styles
  /^src\/app\/.*\/sitemap.*\.tsx?$/, // Sitemaps
  /^src\/app\/.*\/robots\.tsx?$/, // Robots.txt
];

// Files that are likely used but hard to detect (dynamic imports, string-based imports, etc.)
const LIKELY_USED_PATTERNS = [
  /Client\.tsx?$/, // Client components often imported dynamically
  /Service\.ts$/, // Services might be imported dynamically
  /utils\.tsx?$/, // Utility files
  /types\.tsx?$/, // Type definition files
  /config\.tsx?$/, // Configuration files
  /constants\.tsx?$/, // Constants files
  /index\.tsx?$/, // Index/barrel files
];

const files = new Map<string, FileInfo>();
const importMap = new Map<string, Set<string>>(); // file -> set of files that import it

function shouldSkipDir(dirName: string): boolean {
  return SKIP_DIRS.some(skip => 
    dirName.includes(skip) || 
    dirName.startsWith('.') ||
    skip.includes('*') && dirName.includes(skip.replace('*', ''))
  );
}

function shouldSkipFile(fileName: string, filePath: string): boolean {
  if (SKIP_FILES.includes(fileName)) return true;
  if (!/\.(ts|tsx|js|jsx)$/.test(fileName)) return true;
  if (filePath.includes('node_modules')) return true;
  return false;
}

function isEntryPoint(relativePath: string): boolean {
  return ENTRY_POINT_PATTERNS.some(pattern => pattern.test(relativePath));
}

function extractImports(content: string, filePath: string): string[] {
  const imports: string[] = [];
  
  // Match various import patterns
  const importPatterns = [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /from\s+['"]([^'"]+)['"]/g,
  ];

  importPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath && !importPath.startsWith('.') && !importPath.startsWith('/')) {
        // Skip node_modules imports
        continue;
      }
      if (importPath && (importPath.startsWith('.') || importPath.startsWith('@/'))) {
        imports.push(importPath);
      }
    }
  });

  return imports;
}

function resolveImportPath(importPath: string, fromFile: string): string | null {
  const baseDir = dirname(fromFile);
  
  // Handle @/ alias
  if (importPath.startsWith('@/')) {
    const pathWithoutAlias = importPath.replace('@/', 'src/');
    const possiblePaths = [
      `${pathWithoutAlias}.ts`,
      `${pathWithoutAlias}.tsx`,
      `${pathWithoutAlias}/index.ts`,
      `${pathWithoutAlias}/index.tsx`,
    ];
    
    for (const possiblePath of possiblePaths) {
      const fullPath = join(process.cwd(), possiblePath);
      if (existsSync(fullPath)) {
        return relative(process.cwd(), fullPath);
      }
    }
    return null;
  }

  // Handle relative imports
  if (importPath.startsWith('.')) {
    const possiblePaths = [
      join(baseDir, importPath),
      join(baseDir, `${importPath}.ts`),
      join(baseDir, `${importPath}.tsx`),
      join(baseDir, importPath, 'index.ts'),
      join(baseDir, importPath, 'index.tsx'),
    ];

    for (const possiblePath of possiblePaths) {
      if (existsSync(possiblePath)) {
        const resolved = relative(process.cwd(), possiblePath);
        return resolved;
      }
    }
  }

  return null;
}

function scanDirectory(dir: string, baseDir: string = process.cwd()): void {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (shouldSkipDir(entry)) {
        continue;
      }
      scanDirectory(fullPath, baseDir);
    } else if (stat.isFile()) {
      if (shouldSkipFile(entry, fullPath)) {
        continue;
      }

      const relativePath = relative(baseDir, fullPath);
      
      try {
        const content = readFileSync(fullPath, 'utf-8');
        const imports = extractImports(content, fullPath);
        
        files.set(relativePath, {
          path: fullPath,
          relativePath,
          imports,
          exports: [], // Could extract exports too, but imports are more important
          isEntryPoint: isEntryPoint(relativePath),
        });

        // Resolve imports and build reverse dependency map
        imports.forEach(imp => {
          const resolved = resolveImportPath(imp, fullPath);
          if (resolved) {
            if (!importMap.has(resolved)) {
              importMap.set(resolved, new Set());
            }
            importMap.get(resolved)!.add(relativePath);
          }
        });
      } catch (error) {
        // Skip files that can't be read
        console.warn(`Warning: Could not read ${relativePath}`);
      }
    }
  }
}

function findUnusedFiles(): { unused: string[]; likelyUsed: string[] } {
  const unused: string[] = [];
  const likelyUsed: string[] = [];

  files.forEach((fileInfo, filePath) => {
    // Entry points are always considered used
    if (fileInfo.isEntryPoint) {
      return;
    }

    // Check if file is imported anywhere
    const isImported = importMap.has(filePath) && importMap.get(filePath)!.size > 0;
    
    // Check if file is in _archive (we might want to skip these)
    if (excludeArchive && filePath.includes('_archive')) {
      return; // Skip archive files from unused check
    }

    // Check if file matches likely-used patterns
    const matchesLikelyUsed = LIKELY_USED_PATTERNS.some(pattern => pattern.test(filePath));
    
    if (!isImported) {
      if (matchesLikelyUsed) {
        likelyUsed.push(filePath);
      } else {
        unused.push(filePath);
      }
    }
  });

  return { unused: unused.sort(), likelyUsed: likelyUsed.sort() };
}

// Main execution
console.log('🔍 Scanning codebase for unused files...\n');

const startTime = Date.now();
scanDirectory(join(process.cwd(), 'src'));
const { unused, likelyUsed } = findUnusedFiles();
const endTime = Date.now();

console.log(`📊 Analysis complete in ${((endTime - startTime) / 1000).toFixed(2)}s\n`);
console.log(`📁 Total files scanned: ${files.size}`);
console.log(`🔗 Total imports tracked: ${importMap.size}`);
console.log(`🗑️  Unused files found: ${unused.length}`);
console.log(`⚠️  Likely used (but not detected): ${likelyUsed.length}\n`);

if (unused.length === 0 && likelyUsed.length === 0) {
  console.log('✅ No unused files found!\n');
  process.exit(0);
}

// Group by directory for better readability
const groupByDirectory = (fileList: string[]) => {
  const byDirectory = new Map<string, string[]>();
  fileList.forEach(file => {
    const dir = dirname(file);
    if (!byDirectory.has(dir)) {
      byDirectory.set(dir, []);
    }
    byDirectory.get(dir)!.push(file);
  });
  return byDirectory;
};

if (unused.length > 0) {
  console.log('🗑️  Unused files (not imported anywhere):\n');
  const byDirectory = groupByDirectory(unused);
  byDirectory.forEach((files, dir) => {
    console.log(`📁 ${dir}/`);
    files.forEach(file => {
      const fileName = file.split('/').pop();
      console.log(`   - ${fileName}`);
    });
    console.log('');
  });
}

if (likelyUsed.length > 0) {
  console.log('\n⚠️  Files that match "likely used" patterns (review manually):\n');
  const byDirectory = groupByDirectory(likelyUsed);
  byDirectory.forEach((files, dir) => {
    console.log(`📁 ${dir}/`);
    files.forEach(file => {
      const fileName = file.split('/').pop();
      console.log(`   - ${fileName} (might be used via dynamic imports or string-based imports)`);
    });
    console.log('');
  });
}

if (!dryRun) {
  console.log('\n💡 Run with --dry-run to see what would be removed without deleting.\n');
  console.log('💡 To remove these files, review the list above and delete manually.\n');
} else {
  console.log('\n💡 This was a dry run. Files were not deleted.\n');
  console.log('💡 Review the list above and delete manually if confirmed unused.\n');
}

process.exit(0);



