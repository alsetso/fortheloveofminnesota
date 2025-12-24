# Codebase Cleanup Guide

This guide helps you identify and remove unused files from the codebase to reduce errors and improve maintainability.

## Scripts Available

### 1. Find Unused Files
```bash
npm run find-unused
```
Scans the codebase and identifies files that are not imported anywhere. Excludes `_archive` folders by default.

**Options:**
- `--dry-run` (default): Shows what would be removed without deleting
- `--exclude-archive`: Excludes archive folders from analysis (default: true)

### 2. Check Page References
```bash
tsx scripts/check-page-references.ts <route>
```
Before archiving a page, check if it's referenced anywhere in the codebase.

**Example:**
```bash
tsx scripts/check-page-references.ts /ads
```

## Cleanup Process

### Step 1: Run Analysis
```bash
npm run find-unused
```

### Step 2: Review Results
The script will show:
- **Unused files**: Files that are definitely not imported (safe to remove)
- **Likely used files**: Files that match patterns (Client.tsx, Service.ts, etc.) - review manually

### Step 3: Manual Review
Before deleting, check:
1. **Dynamic imports**: Files might be imported using `import()` or `require()`
2. **String-based imports**: Some imports use string paths
3. **Next.js conventions**: Some files are used by Next.js automatically (page.tsx, layout.tsx, etc.)
4. **Type definitions**: `.d.ts` files might be used for type checking

### Step 4: Delete Files
After confirming files are unused:
1. Delete files one directory at a time
2. Test the build after each deletion
3. Commit changes incrementally

## Common Patterns

### Files That Are Always Used
- `src/app/**/page.tsx` - Next.js pages
- `src/app/**/layout.tsx` - Next.js layouts
- `src/app/**/route.ts` - API routes
- `src/middleware.ts` - Next.js middleware

### Files That Might Be Used
- Files ending in `Client.tsx` - Often imported dynamically
- Files ending in `Service.ts` - Services might be imported dynamically
- Files named `index.ts` or `index.tsx` - Barrel exports
- Files in `_archive` folders - Already archived, can be ignored

## Best Practices

1. **Start with obvious unused files**: Components that are clearly not referenced
2. **Test incrementally**: Delete a few files, test, then continue
3. **Keep archive folders**: Don't delete `_archive` folders - they're intentionally kept
4. **Check for side effects**: Some files might have side effects when imported
5. **Review git history**: Check when files were last modified to understand usage

## Troubleshooting

### Script finds files that are actually used
- Check for dynamic imports: `import('./Component')`
- Check for string-based imports
- Check if file is used in configuration files
- Check if file is used in build scripts

### Build fails after deleting files
- Check if file was used in a way the script couldn't detect
- Restore from git and investigate further
- Check for runtime imports or string-based imports

## Example Workflow

```bash
# 1. Find unused files
npm run find-unused

# 2. Review the output, identify safe-to-delete files

# 3. Delete a small batch
rm src/components/SomeUnusedComponent.tsx

# 4. Test build
npm run build

# 5. If successful, commit
git add -A
git commit -m "Remove unused component"

# 6. Repeat for next batch
```



