import type { NextConfig } from 'next'
import { MAX_FILE_SIZE } from '@repo/env/config'

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ['@repo/env', '@repo/ui'],
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
    taint: true,
    serverActions: {
      bodySizeLimit: `${MAX_FILE_SIZE / 1024 / 1024}mb`,
    },
  },
}

export default nextConfig
