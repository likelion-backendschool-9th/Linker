import type { NextConfig } from 'next';
import path from 'node:path';

const imageHost = process.env.NEXT_PUBLIC_IMAGE_HOST;
// Uploaded images are served by the backend at /files/ (local storage). Rewrites are fixed when the
// config loads: Docker builds pass FILES_UPSTREAM_URL, `pnpm dev` falls back to API_INTERNAL_URL.
const filesUpstream =
  process.env.FILES_UPSTREAM_URL ?? process.env.API_INTERNAL_URL ?? 'http://localhost:8080';

// cacheComponents stays off for the MVP (blueprint §9-2)
const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  typedRoutes: true,
  devIndicators: false,
  // Always defined, so an unset flag is inlined as 'false' and the bundler drops the mock code (blueprint §1-2)
  env: { NEXT_PUBLIC_USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS ?? 'false' },
  transpilePackages: ['@linker/api', '@linker/bridge'],
  async rewrites() {
    // Keep blueprint §8-1's public URLs while Next metadata routes use /sitemap/[id].xml.
    // /files/ also reaches the backend without the proxy (pnpm dev) and for next/image optimization.
    return [
      ...['posts', 'recruits', 'users'].map((kind) => ({
        source: `/sitemap/${kind}/:id.xml`,
        destination: `/sitemap/${kind}/sitemap/:id.xml`,
      })),
      { source: '/files/:path*', destination: `${filesUpstream}/files/:path*` },
    ];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      ...(imageHost ? [{ protocol: 'https' as const, hostname: imageHost }] : []),
    ],
    deviceSizes: [360, 414, 600, 1024, 1440],
    imageSizes: [24, 32, 40, 48, 64, 96, 128, 256],
  },
};

export default nextConfig;
