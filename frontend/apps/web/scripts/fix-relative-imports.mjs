/**
 * After nesting component.tsx into component/Pascal.tsx, relative imports that
 * no longer resolve must gain one extra "../".
 */
import fs from 'node:fs';
import path from 'node:path';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'e2e', 'test-results', 'scripts'].includes(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function existsModule(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
  ];
  return candidates.some((p) => fs.existsSync(p));
}

let filesChanged = 0;
let importsChanged = 0;

for (const file of walk(WEB_ROOT)) {
  if (!/\.(tsx|ts)$/.test(file)) continue;
  // Only adjust files that look like nested component modules
  if (!fs.existsSync(path.join(path.dirname(file), 'api.ts'))) continue;

  const dir = path.dirname(file);
  let text = fs.readFileSync(file, 'utf8');
  const next = text.replace(
    /((?:import|export)\s+[\s\S]*?\sfrom\s+|import\s*\(\s*)(['"])(\.\.?\/[^'"]+)\2/g,
    (full, prefix, quote, spec) => {
      const resolved = path.resolve(dir, spec);
      if (existsModule(resolved)) return full;
      const bumped = `../${spec}`;
      const bumpedResolved = path.resolve(dir, bumped);
      if (!existsModule(bumpedResolved)) return full;
      importsChanged += 1;
      return `${prefix}${quote}${bumped}${quote}`;
    },
  );
  if (next !== text) {
    fs.writeFileSync(file, next, 'utf8');
    filesChanged += 1;
  }
}

console.log(`files=${filesChanged} imports=${importsChanged}`);
