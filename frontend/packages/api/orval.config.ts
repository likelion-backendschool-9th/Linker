import { defineConfig } from 'orval';

// springdoc /v3/api-docs → one file per controller @Tag (= page) (blueprint §2-1)
const input = process.env.OPENAPI_URL ?? 'http://localhost:8080/v3/api-docs';

export default defineConfig({
  linker: {
    input,
    output: {
      mode: 'tags-split',
      target: 'src/generated',
      client: 'react-query',
      httpClient: 'fetch',
      mock: { generators: [{ type: 'msw' }] },
      clean: true,
      override: {
        mutator: {
          path: '../../apps/web/src/lib/api/api-fetch.ts',
          name: 'apiFetch',
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
        query: {
          useQuery: true,
          useSuspenseQuery: true,
          usePrefetch: true,
        },
      },
    },
  },
  linkerZod: {
    input,
    output: {
      mode: 'tags-split',
      target: 'src/generated',
      client: 'zod',
      fileExtension: '.zod.ts',
    },
  },
});
