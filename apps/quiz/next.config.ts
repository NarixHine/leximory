import type { NextConfig } from 'next'
import { MAX_FILE_SIZE } from '@repo/env/config'

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
    serverActions: {
      bodySizeLimit: `${MAX_FILE_SIZE / 1024 / 1024}mb`,
    },
    turbopackFileSystemCacheForBuild: true,
    turbopackFileSystemCacheForDev: true,
    taint: true
  },
  transpilePackages: ['nuqs'],
}

export default nextConfig
