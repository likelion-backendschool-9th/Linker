import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(path.join(pkgRoot, 'package.json'));
const orvalBin = path.join(
  path.dirname(require.resolve('orval/package.json')),
  'dist/bin/orval.mjs',
);
const outDir = await mkdtemp(path.join(tmpdir(), 'linker-orval-'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [orvalBin, '--config', './orval.pipeline.config.ts'], {
      cwd: pkgRoot,
      env: { ...process.env, ORVAL_PIPELINE_OUT: outDir },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (status) => resolve(status ?? 1));
  });
  assert(code === 0, `orval exited ${code}`);

  const client = await readFile(path.join(outDir, 'p00-common', 'p00-common.ts'), 'utf8');
  const zod = await readFile(path.join(outDir, 'p00-common', 'p00-common.zod.ts'), 'utf8');
  const msw = await readFile(path.join(outDir, 'p00-common', 'p00-common.msw.ts'), 'utf8');

  assert(client.includes('api-fetch'), 'generated client must call apiFetch');
  assert(client.includes('return `/api/v1/user/me`'), 'generated url must stay a path');
  assert(client.includes('export function useGetMe'), 'GET stays a query');
  assert(client.includes('useGetMeSuspense'), 'GET keeps a suspense hook');
  assert(client.includes('prefetchGetMeQuery'), 'GET keeps prefetch');
  assert(client.includes('export const useCreateBlock'), 'POST stays a mutation hook');
  assert(client.includes('return useMutation('), 'POST calls useMutation');
  assert(!client.includes('prefetchCreateBlockQuery'), 'POST must not be generated as a query');
  assert(zod.includes("from 'zod'"), 'zod schemas are generated');
  assert(msw.includes('http.get'), 'msw handlers are generated');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
