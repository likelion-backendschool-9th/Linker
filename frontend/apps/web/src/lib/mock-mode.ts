/**
 * Mock data mode (blueprint §1-2): `NEXT_PUBLIC_USE_MOCKS=true` answers every `apiFetch` call from
 * `src/mocks/` instead of Spring. Inlined at build time, so production builds drop the mock code.
 */
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';
