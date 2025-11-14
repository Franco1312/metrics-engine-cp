#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Mapeo de rutas relativas a absolutas
// IMPORTANTE: El orden importa - primero los más específicos (más niveles)
const pathMappings = [
  // Desde subdirectorios profundos (cuatro niveles arriba) - primero
  { from: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/(domain|infrastructure|interfaces|application)\//g, to: (match, p1) => `from '@/${p1}/"` },
  
  // Desde subdirectorios de infrastructure/interfaces (tres niveles arriba)
  { from: /from ['"]\.\.\/\.\.\/\.\.\/domain\//g, to: "from '@/domain/" },
  { from: /from ['"]\.\.\/\.\.\/\.\.\/infrastructure\//g, to: "from '@/infrastructure/" },
  { from: /from ['"]\.\.\/\.\.\/\.\.\/interfaces\//g, to: "from '@/interfaces/" },
  { from: /from ['"]\.\.\/\.\.\/\.\.\/application\//g, to: "from '@/application/" },
  
  // Desde infrastructure/interfaces/application (dos niveles arriba)
  { from: /from ['"]\.\.\/\.\.\/domain\//g, to: "from '@/domain/" },
  { from: /from ['"]\.\.\/\.\.\/infrastructure\//g, to: "from '@/infrastructure/" },
  { from: /from ['"]\.\.\/\.\.\/interfaces\//g, to: "from '@/interfaces/" },
  { from: /from ['"]\.\.\/\.\.\/application\//g, to: "from '@/application/" },
  
  // Desde domain (un nivel arriba)
  { from: /from ['"]\.\.\/constants\//g, to: "from '@/domain/constants/" },
  { from: /from ['"]\.\.\/entities\//g, to: "from '@/domain/entities/" },
  { from: /from ['"]\.\.\/interfaces\//g, to: "from '@/domain/interfaces/" },
  { from: /from ['"]\.\.\/ports\//g, to: "from '@/domain/ports/" },
  { from: /from ['"]\.\.\/dto\//g, to: "from '@/domain/dto/" },
  { from: /from ['"]\.\.\/errors\//g, to: "from '@/domain/errors/" },
  { from: /from ['"]\.\.\/services\//g, to: "from '@/domain/services/" },
  
  // Desde infrastructure (un nivel arriba)
  { from: /from ['"]\.\.\/config\//g, to: "from '@/infrastructure/config/" },
  { from: /from ['"]\.\.\/db\//g, to: "from '@/infrastructure/db/" },
  { from: /from ['"]\.\.\/shared\//g, to: "from '@/infrastructure/shared/" },
  { from: /from ['"]\.\.\/aws\//g, to: "from '@/infrastructure/aws/" },
  { from: /from ['"]\.\.\/s3\//g, to: "from '@/infrastructure/s3/" },
];

function updateImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Aplicar todos los mapeos
    for (const mapping of pathMappings) {
      let newContent;
      if (typeof mapping.to === 'function') {
        newContent = content.replace(mapping.from, mapping.to);
      } else {
        newContent = content.replace(mapping.from, mapping.to);
      }
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Updated: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function findTypeScriptFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, dist, etc.
      if (!['node_modules', 'dist', '.git', 'coverage'].includes(file)) {
        findTypeScriptFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Main execution
const srcDir = path.join(__dirname, '..', 'src');
const files = findTypeScriptFiles(srcDir);

console.log(`Found ${files.length} TypeScript files\n`);
console.log('Updating imports...\n');

let updatedCount = 0;
files.forEach(file => {
  if (updateImportsInFile(file)) {
    updatedCount++;
  }
});

console.log(`\n✓ Updated ${updatedCount} files`);
console.log(`  (${files.length - updatedCount} files had no relative imports to update)`);

