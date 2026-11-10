import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Generate only B's 09/10 contracts until the repository-wide OpenAPI refresh is coordinated.
// Reuse the shared Orval factory; never rewrite other owners' generated clients or schemas.
const response = await fetch(process.env.OPENAPI_URL ?? 'http://localhost:8080/v3/api-docs');
if (!response.ok) throw new Error(`OpenAPI request failed: ${response.status}`);
const document = await response.json();
const tags = new Set(['p09-team-settings', 'p10-invite']);
const paths = {};
for (const [path, item] of Object.entries(document.paths)) {
  const selected = Object.entries(item).filter(([, operation]) =>
    operation.tags?.some((tag) => tags.has(tag)),
  );
  if (selected.length) paths[path] = Object.fromEntries(selected);
}
if (!Object.keys(paths).length) throw new Error('Team invitation contracts are missing');
const schemas = {};
function collect(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.$ref === 'string' && value.$ref.startsWith('#/components/schemas/')) {
    const name = value.$ref.slice('#/components/schemas/'.length);
    if (!(name in schemas)) {
      const schema = document.components?.schemas?.[name];
      if (!schema) throw new Error(`Missing referenced schema: ${name}`);
      schemas[name] = schema;
      collect(schema);
    }
  }
  for (const item of Object.values(value)) collect(item);
}
collect(paths);
// Preserve nullable references emitted by springdoc when Orval consumes OpenAPI 3.1.
function normalizeNullableReferences(value) {
  if (Array.isArray(value)) return value.map(normalizeNullableReferences);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeNullableReferences(item)]),
  );
  if (
    result.$ref &&
    (result.nullable === true ||
      result.type === 'null' ||
      (Array.isArray(result.type) && result.type.includes('null')))
  ) {
    const reference = result.$ref;
    delete result.$ref;
    delete result.nullable;
    delete result.type;
    return { ...result, anyOf: [{ $ref: reference }, { type: 'null' }] };
  }
  return result;
}
const directory = await mkdtemp(join(tmpdir(), 'linker-team-invitations-'));
try {
  const source = join(directory, 'openapi.json');
  await writeFile(
    source,
    JSON.stringify({
      ...document,
      paths,
      components: { ...document.components, schemas: normalizeNullableReferences(schemas) },
    }),
    { mode: 0o600 },
  );
  const result = spawnSync(
    'pnpm',
    ['exec', 'orval', '--config', './orval.team-invitations.config.ts'],
    {
      stdio: 'inherit',
      env: { ...process.env, TEAM_INVITATIONS_OPENAPI_FILE: source },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Team invitation generation failed: ${result.status}`);
  // Keep generated diffs clean without hand-editing generated source files.
  const output = join(import.meta.dirname, '../src/team-invitations');
  for (const file of await readdir(output, { recursive: true })) {
    if (!file.endsWith('.ts')) continue;
    const target = join(output, file);
    const contents = await readFile(target, 'utf8');
    await writeFile(target, `${contents.trimEnd()}\n`);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
