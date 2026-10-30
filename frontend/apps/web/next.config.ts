import type { NextConfig } from 'next';

const imageHost = process.env.NEXT_PUBLIC_IMAGE_HOST;

// cacheComponents stays off for the MVP (blueprint §9-2)
const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ['@linker/api', '@linker/bridge'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      ...(imageHost ? [{ protocol: 'https' as const, hostname: imageHost }] : []),
    ],
    deviceSizes: [360, 414, 640, 768, 1024, 1280],
    imageSizes: [24, 32, 40, 48, 64, 96, 128, 256],
  },
};

export default nextConfig;
