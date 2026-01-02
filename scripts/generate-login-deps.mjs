import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const filePath = './src/auth/Login.js';

function isThirdParty(importPath) {
  return !importPath.startsWith('.') && !importPath.startsWith('/');
}

async function extractImports(filePath, visited = new Set()) {
  if (visited.has(filePath)) return [];
  visited.add(filePath);

  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  const imports = [];

  for (const line of lines) {
    if (!line.trim().startsWith('import')) continue;
    const match = line.match(/['"](.+)['"]/);
    if (!match) continue;

    let importPath = match[1];
    const isExternal = isThirdParty(importPath);

    if (isExternal) {
      imports.push({ source: filePath, target: importPath, thirdParty: true });
      continue;
    }

    const baseDir = path.dirname(filePath);
    let resolvedPath = path.resolve(baseDir, importPath);

    if (!(await fileExists(resolvedPath))) {
      if (await fileExists(resolvedPath + '.js')) {
        resolvedPath += '.js';
      } else if (await fileExists(resolvedPath + '.jsx')) {
        resolvedPath += '.jsx';
      } else {
        continue;
      }
    }

    imports.push({ source: filePath, target: resolvedPath, thirdParty: false });

    // 🔁 Recursively walk local imports
    const subImports = await extractImports(resolvedPath, visited);
    imports.push(...subImports);
  }

  return imports;
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function sanitizeId(id) {
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
  }
  
  function createMermaid(imports) {
    const lines = ['flowchart TD'];
    const nodes = new Set();
  
    for (const { source, target, thirdParty } of imports) {
      const sourceId = sanitizeId(path.basename(source));
      const targetId = sanitizeId(thirdParty ? target : path.basename(target));
      const sourceLabel = path.basename(source);
      const targetLabel = thirdParty ? target : path.basename(target);
  
      if (!nodes.has(sourceId)) {
        lines.push(`    ${sourceId}["${sourceLabel}"]`);
        nodes.add(sourceId);
      }
  
      if (!nodes.has(targetId)) {
        lines.push(`    ${targetId}["${targetLabel}"]`);
        nodes.add(targetId);
      }
  
      lines.push(`    ${sourceId} --> ${targetId}`);
  
      if (thirdParty) {
        lines.push(`    class ${targetId} thirdparty`);
      }
    }
  
    lines.push(`    classDef thirdparty fill:#ffe,stroke:#888;`);
    return lines.join('\n');
  }
  

async function run() {
  const entry = path.resolve('./src/auth/Login.js');
  const imports = await extractImports(entry);
  const mermaid = createMermaid(imports);
  await fs.writeFile('./login-deps.mmd', mermaid);
  console.log('✅ Mermaid diagram saved to login-deps.mmd');
}

run();
