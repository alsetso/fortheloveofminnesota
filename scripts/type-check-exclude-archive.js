#!/usr/bin/env node

/**
 * TypeScript type checking that excludes _archive folders
 * This script is used to verify types without checking archived code
 */

const { execSync } = require('child_process');
const path = require('path');

// Run TypeScript check with explicit exclude patterns
const excludePatterns = [
  '**/_archive/**',
  '**/*_archive/**',
  'src/app/_archive/**',
  'src/components/_archive/**',
  'src/features/_archive/**',
  'src/app/api/_archive/**',
].map(pattern => `--exclude "${pattern}"`).join(' ');

try {
  execSync(
    `npx tsc --noEmit --skipLibCheck ${excludePatterns}`,
    { stdio: 'inherit', cwd: path.resolve(__dirname, '..') }
  );
  console.log('✅ Type check passed (archive folders excluded)');
  process.exit(0);
} catch (error) {
  console.error('❌ Type check failed');
  process.exit(1);
}



