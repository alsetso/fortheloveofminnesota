#!/usr/bin/env tsx
/**
 * Archive Page Reference Checker
 * 
 * Finds all references to a page route before archiving it.
 * Usage: tsx scripts/check-page-references.ts /ads
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const pageRoute = process.argv[2];

if (!pageRoute) {
  console.error('Usage: tsx scripts/check-page-references.ts <route>');
  console.error('Example: tsx scripts/check-page-references.ts /ads');
  process.exit(1);
}

const normalizedRoute = pageRoute.startsWith('/') ? pageRoute : `/${pageRoute}`;
const routePattern = new RegExp(
  `["'\`]${normalizedRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:["'\`/]|$)`,
  'g'
);

interface Reference {
  file: string;
  line: number;
  content: string;
}

const references: Reference[] = [];

function searchDirectory(dir: string, baseDir: string = dir) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules, .next, and other build/cache directories
      if (
        entry.startsWith('.') ||
        entry === 'node_modules' ||
        entry === '.next' ||
        entry === 'dist' ||
        entry === 'build'
      ) {
        continue;
      }
      searchDirectory(fullPath, baseDir);
    } else if (stat.isFile()) {
      // Only search relevant file types
      if (
        entry.endsWith('.ts') ||
        entry.endsWith('.tsx') ||
        entry.endsWith('.js') ||
        entry.endsWith('.jsx') ||
        entry.endsWith('.json') ||
        entry.endsWith('.md')
      ) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            if (routePattern.test(line)) {
              references.push({
                file: fullPath.replace(baseDir + '/', ''),
                line: index + 1,
                content: line.trim(),
              });
            }
          });
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }
  }
}

console.log(`\n🔍 Searching for references to: ${normalizedRoute}\n`);
searchDirectory(process.cwd());

if (references.length === 0) {
  console.log('✅ No references found. Safe to archive.\n');
} else {
  console.log(`⚠️  Found ${references.length} reference(s):\n`);
  
  // Group by file
  const byFile = new Map<string, Reference[]>();
  references.forEach((ref) => {
    if (!byFile.has(ref.file)) {
      byFile.set(ref.file, []);
    }
    byFile.get(ref.file)!.push(ref);
  });

  byFile.forEach((refs, file) => {
    console.log(`📄 ${file}`);
    refs.forEach((ref) => {
      console.log(`   Line ${ref.line}: ${ref.content.substring(0, 80)}${ref.content.length > 80 ? '...' : ''}`);
    });
    console.log('');
  });

  console.log('\n⚠️  Update these references before archiving the page.\n');
}




