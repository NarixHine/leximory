import type { NextConfig } from 'next'
import { MAX_FILE_SIZE } from '@repo/env/config'
import { withWorkflow } from 'workflow/next'

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
}

export default withWorkflow(nextConfig)
