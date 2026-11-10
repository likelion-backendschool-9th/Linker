import { defineConfig } from 'orval';

// springdoc /v3/api-docs → one file per controller @Tag (= page) (blueprint §2-1)
const mutator = {
  path: '../../apps/web/lib/api/api-fetch.ts',
  name: 'apiFetch',
} as const;

/**
 * `input` is the OpenAPI document. `target` is the generated folder.
 * The pipeline check calls this with a fixture so the options stay the ones `pnpm generate` uses.
 */
export function createOrvalConfig(input: string, target = 'src/generated') {
  return defineConfig({
    linker: {
      input,
      output: {
        mode: 'tags-split',
        target,
        client: 'react-query',
        httpClient: 'fetch',
        mock: { generators: [{ type: 'msw' }] },
        clean: true,
        override: {
          mutator,
          fetch: {
            includeHttpResponseReturnType: false,
          },
          query: {
            // Leave useQuery / useMutation unset. Orval 8 treats a global `true` as every verb,
            // then drops the other hook: POST would no longer be a mutation.
            useSuspenseQuery: true,
            usePrefetch: true,
          },
        },
      },
    },
    // Runs after `linker`. `clean: false` so the zod files are not wiped with the react-query output.
    linkerZod: {
      input,
      output: {
        mode: 'tags-split',
        target,
        client: 'zod',
        fileExtension: '.zod.ts',
        clean: false,
      },
    },
  });
}

export default createOrvalConfig(process.env.OPENAPI_URL ?? 'http://localhost:8080/v3/api-docs');
