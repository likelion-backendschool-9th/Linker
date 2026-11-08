/**
 * Restructure colocated components into:
 *   kebab-folder/PascalCase.tsx + api.ts + hook.ts + PascalCase.module.css
 * Then rewrite imports that pointed at the old flat file.
 */
import fs from 'node:fs';
import path from 'node:path';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');
const ROUTE_FILES = new Set([
  'page.tsx',
  'layout.tsx',
  'loading.tsx',
  'error.tsx',
  'not-found.tsx',
  'template.tsx',
  'default.tsx',
  'route.ts',
  'route.tsx',
  'proxy.ts',
]);

function toPascalCase(stem) {
  return stem
    .split(/[-_.]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      walkFiles(full, out);
    } else out.push(full);
  }
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeIfMissing(file, contents) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, contents, 'utf8');
}

function moveFile(from, to) {
  if (from === to) return true;
  ensureDir(path.dirname(to));
  if (fs.existsSync(to)) {
    console.warn('skip existing', path.relative(WEB_ROOT, to));
    return false;
  }
  fs.renameSync(from, to);
  return true;
}

function posixRel(from, to) {
  let rel = path.relative(from, to).replaceAll('\\', '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function collectTargets() {
  const files = [
    ...walkFiles(path.join(WEB_ROOT, 'app')),
    ...walkFiles(path.join(WEB_ROOT, 'components')),
    ...walkFiles(path.join(WEB_ROOT, 'features')),
  ];
  return files.filter((f) => {
    const base = path.basename(f);
    if (!base.endsWith('.tsx')) return false;
    if (base.endsWith('.test.tsx') || base.endsWith('.spec.tsx')) return false;
    if (ROUTE_FILES.has(base)) return false;
    const rel = path.relative(WEB_ROOT, f).replaceAll('\\', '/');
    if (rel.startsWith('app/')) return rel.includes('/_components/');
    return rel.startsWith('components/') || rel.startsWith('features/');
  });
}

function restructureOne(tsxPath, importMap) {
  const dir = path.dirname(tsxPath);
  const file = path.basename(tsxPath);
  const stem = file.replace(/\.tsx$/, '');
  const pascal = toPascalCase(stem);
  const folderName = stem;

  // Already: kebab/Pascal.tsx with sidecars
  if (
    path.basename(dir) === folderName &&
    file === `${pascal}.tsx` &&
    fs.existsSync(path.join(dir, 'api.ts'))
  ) {
    return;
  }

  // File already PascalCase sitting in a kebab folder named differently — use parent as folder
  let targetDir;
  if (file === `${pascal}.tsx` && path.basename(dir) !== folderName && !file.includes('-')) {
    // e.g. rare case; still nest under kebab of pascal
    const kebab = pascal
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
    targetDir = path.join(dir, kebab);
  } else if (path.basename(dir) === folderName && file === `${pascal}.tsx`) {
    targetDir = dir;
  } else {
    targetDir = path.join(dir, folderName);
  }

  ensureDir(targetDir);
  const targetTsx = path.join(targetDir, `${pascal}.tsx`);
  const oldImportPath = tsxPath.replace(/\.tsx$/, '').replaceAll('\\', '/');
  const newImportPath = targetTsx.replace(/\.tsx$/, '').replaceAll('\\', '/');

  moveFile(tsxPath, targetTsx);

  const siblingCss = path.join(dir, `${stem}.module.css`);
  const targetCss = path.join(targetDir, `${pascal}.module.css`);
  if (fs.existsSync(siblingCss)) moveFile(siblingCss, targetCss);
  else writeIfMissing(targetCss, `/* Styles for ${pascal} */\n`);

  const siblingTest = path.join(dir, `${stem}.test.tsx`);
  if (fs.existsSync(siblingTest)) {
    moveFile(siblingTest, path.join(targetDir, `${pascal}.test.tsx`));
  }

  writeIfMissing(
    path.join(targetDir, 'api.ts'),
    `/** API / query helpers for ${pascal}. Keep view components free of fetch/orval calls. */\n`,
  );
  writeIfMissing(
    path.join(targetDir, 'hook.ts'),
    `/** Event and behavior hooks for ${pascal}. */\n`,
  );

  if (fs.existsSync(targetTsx)) {
    let src = fs.readFileSync(targetTsx, 'utf8');
    src = src.replaceAll(`./${stem}.module.css`, `./${pascal}.module.css`);
    fs.writeFileSync(targetTsx, src, 'utf8');
  }

  importMap.set(oldImportPath, newImportPath);
  // Also map when importers used the folder path equal to stem (without nesting yet)
  const flatKey = path.join(dir, stem).replaceAll('\\', '/');
  importMap.set(flatKey, newImportPath);
}

function rewriteImports(importMap) {
  const files = walkFiles(WEB_ROOT).filter((f) => /\.(tsx?|mts|mjs)$/.test(f));
  let changedFiles = 0;

  for (const file of files) {
    if (file.includes(`${path.sep}scripts${path.sep}`)) continue;
    let text = fs.readFileSync(file, 'utf8');
    const original = text;
    const fileDir = path.dirname(file);

    // Replace import/export path literals
    text = text.replace(
      /((?:import|export)\s+[\s\S]*?\sfrom\s+|import\s*\(\s*|export\s+\*\s+from\s+)(['"])([^'"]+)\2/g,
      (full, prefix, quote, spec) => {
        if (!spec.startsWith('.') && !spec.startsWith('@/')) return full;
        let abs;
        if (spec.startsWith('@/')) {
          abs = path.join(WEB_ROOT, spec.slice(2)).replaceAll('\\', '/');
        } else {
          abs = path.normalize(path.join(fileDir, spec)).replaceAll('\\', '/');
        }
        // strip extension if present
        const absNoExt = abs.replace(/\.(tsx|ts|jsx|js)$/, '');
        const mapped = importMap.get(absNoExt);
        if (!mapped) return full;

        let nextSpec;
        if (spec.startsWith('@/')) {
          nextSpec = `@/${path.relative(WEB_ROOT, mapped).replaceAll('\\', '/')}`;
        } else {
          nextSpec = posixRel(fileDir, mapped);
        }
        // drop trailing extensions from mapped for TS imports
        nextSpec = nextSpec.replace(/\.(tsx|ts)$/, '');
        return `${prefix}${quote}${nextSpec}${quote}`;
      },
    );

    if (text !== original) {
      fs.writeFileSync(file, text, 'utf8');
      changedFiles += 1;
    }
  }
  console.log(`import_files_updated=${changedFiles}`);
}

function main() {
  const targets = collectTargets().sort(
    (a, b) => b.split(path.sep).length - a.split(path.sep).length || b.length - a.length,
  );
  const importMap = new Map();
  for (const file of targets) {
    if (!fs.existsSync(file)) continue;
    restructureOne(file, importMap);
  }
  console.log(`component_moves=${importMap.size}`);
  rewriteImports(importMap);
}

main();
