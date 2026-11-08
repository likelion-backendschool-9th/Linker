import fs from 'node:fs';
import path from 'node:path';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'e2e', 'test-results'].includes(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function toPascal(stem) {
  return stem
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
}

const map = new Map();
for (const file of walk(path.join(WEB_ROOT, 'app'))) {
  if (!file.includes(`${path.sep}_views${path.sep}`)) continue;
  if (!file.endsWith('.tsx') || file.endsWith('.test.tsx')) continue;
  const base = path.basename(file, '.tsx');
  if (/^[A-Z]/.test(base) && !base.includes('-')) continue;
  const pascal = toPascal(base);
  const dest = path.join(path.dirname(file), `${pascal}.tsx`);
  fs.renameSync(file, dest);
  map.set(base, pascal);
  const css = path.join(path.dirname(file), `${base}.module.css`);
  if (fs.existsSync(css)) {
    fs.renameSync(css, path.join(path.dirname(file), `${pascal}.module.css`));
  }
  const test = path.join(path.dirname(file), `${base}.test.tsx`);
  if (fs.existsSync(test)) {
    fs.renameSync(test, path.join(path.dirname(file), `${pascal}.test.tsx`));
  }
}

let updated = 0;
for (const file of walk(WEB_ROOT)) {
  if (!/\.(tsx?|mts)$/.test(file)) continue;
  let text = fs.readFileSync(file, 'utf8');
  let next = text;
  for (const [oldStem, newStem] of map) {
    next = next.replaceAll(`./${oldStem}`, `./${newStem}`);
    next = next.replaceAll(`./_views/${oldStem}`, `./_views/${newStem}`);
    next = next.replaceAll(`${oldStem}.module.css`, `${newStem}.module.css`);
  }
  if (next !== text) {
    fs.writeFileSync(file, next, 'utf8');
    updated += 1;
  }
}

console.log(`views_renamed=${map.size} import_files=${updated}`);
