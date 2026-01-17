import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const srcDir = path.join(process.cwd(), 'src');

// Find all component files
async function findComponentFiles(): Promise<string[]> {
  const componentsDir = path.join(srcDir, 'components');
  const files = await glob('**/*.{tsx,ts}', { 
    cwd: componentsDir,
    absolute: true 
  });
  return files;
}

// Find all source files that might import components
async function findSourceFiles(): Promise<string[]> {
  const files = await glob('**/*.{tsx,ts}', { 
    cwd: srcDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.next/**']
  });
  return files;
}

// Extract component name from file path
function getComponentName(filePath: string): string {
  const relative = path.relative(path.join(srcDir, 'components'), filePath);
  const name = path.basename(relative, path.extname(relative));
  return name;
}

// Get import paths that would reference this component
function getPossibleImportPaths(filePath: string): string[] {
  const relative = path.relative(srcDir, filePath);
  const withoutExt = relative.replace(/\.(tsx|ts)$/, '');
  
  const paths: string[] = [];
  
  // Direct import
  paths.push(`@/components/${withoutExt}`);
  
  // Also check without /components prefix (if imported from index)
  const parts = withoutExt.split(path.sep);
  if (parts[0] === 'components') {
    paths.push(`@/${withoutExt}`);
  }
  
  // Check component name itself
  const componentName = path.basename(withoutExt);
  paths.push(componentName);
  
  // Check directory-based imports
  const dir = path.dirname(relative);
  if (dir.includes('components')) {
    const dirParts = dir.split(path.sep);
    const componentsIndex = dirParts.indexOf('components');
    if (componentsIndex !== -1) {
      const afterComponents = dirParts.slice(componentsIndex + 1).join('/');
      paths.push(`@/components/${afterComponents}/${componentName}`);
    }
  }
  
  return paths;
}

// Check if a file imports a component
function fileImportsComponent(fileContent: string, importPaths: string[]): boolean {
  for (const importPath of importPaths) {
    // Check various import patterns
    const patterns = [
      new RegExp(`from ['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
      new RegExp(`import.*['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
      new RegExp(`require\\(['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`, 'g'),
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(fileContent)) {
        return true;
      }
    }
  }
  
  return false;
}

async function main() {
  console.log('Finding component files...');
  const componentFiles = await findComponentFiles();
  console.log(`Found ${componentFiles.length} component files`);
  
  console.log('Finding source files...');
  const sourceFiles = await findSourceFiles();
  console.log(`Found ${sourceFiles.length} source files`);
  
  console.log('Analyzing usage...');
  const unused: string[] = [];
  const used: string[] = [];
  
  for (const componentFile of componentFiles) {
    const componentName = getComponentName(componentFile);
    const importPaths = getPossibleImportPaths(componentFile);
    
    // Skip index files and certain utility files
    if (componentName === 'index' || componentFile.includes('.example.')) {
      continue;
    }
    
    let isUsed = false;
    
    for (const sourceFile of sourceFiles) {
      // Skip the component file itself
      if (sourceFile === componentFile) {
        continue;
      }
      
      try {
        const content = fs.readFileSync(sourceFile, 'utf-8');
        if (fileImportsComponent(content, importPaths)) {
          isUsed = true;
          break;
        }
      } catch (error) {
        // Skip files we can't read
      }
    }
    
    if (isUsed) {
      used.push(componentFile);
    } else {
      unused.push(componentFile);
    }
  }
  
  console.log(`\n✅ Used: ${used.length}`);
  console.log(`❌ Unused: ${unused.length}\n`);
  
  if (unused.length > 0) {
    console.log('Unused components:');
    unused.forEach(file => {
      const relative = path.relative(process.cwd(), file);
      console.log(`  - ${relative}`);
    });
  }
  
  // Write results to file
  fs.writeFileSync(
    path.join(process.cwd(), 'unused-components.json'),
    JSON.stringify({ used: used.map(f => path.relative(process.cwd(), f)), unused: unused.map(f => path.relative(process.cwd(), f)) }, null, 2)
  );
  
  console.log('\nResults written to unused-components.json');
}

main().catch(console.error);
