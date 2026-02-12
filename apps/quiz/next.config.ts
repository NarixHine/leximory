import type { NextConfig } from 'next'
import { MAX_FILE_SIZE } from '@repo/env/config'

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: [],
  transpilePackages: ['@repo/ui', 'isomorphic-dompurify'],
  experimental: {
    authInterrupts: true,
    optimizePackageImports: ['@phosphor-icons/react'],
    serverActions: {
      bodySizeLimit: `${MAX_FILE_SIZE / 1024 / 1024}mb`,
    },
    turbopackFileSystemCacheForBuild: true,
    turbopackFileSystemCacheForDev: true,
    taint: true
  },
}

export default nextConfig
