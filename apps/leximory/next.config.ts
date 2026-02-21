import createMDX from '@next/mdx'
import { withSerwist } from '@serwist/turbopack'
import { NextConfig } from 'next'
import { ALLOWED_IMAGE_REMOTE_PATTERNS, FYP_BLOG_LINK } from '@repo/env/config'

const nextConfig: NextConfig = {
    cacheComponents: true,
    experimental: {
        mdxRs: true,
        serverActions: {
            bodySizeLimit: '4.5mb',
        },
        turbopackFileSystemCacheForBuild: true,
        turbopackFileSystemCacheForDev: true,
    },
    images: {
        remotePatterns: [
            ...ALLOWED_IMAGE_REMOTE_PATTERNS
        ],
    },
    pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
    async redirects() {
        return [{
            source: '/fix',
            destination: FYP_BLOG_LINK,
            permanent: true,
        }, {
            source: '/chat',
            destination: '/blog/ai-agent',
            permanent: true,
        }]
    },
    async rewrites() {
        return [{
            source: '/ebooks/:token/:id\\.epub',
            destination: 'https://pcsjszvydprmevipvpva.supabase.co/storage/v1/object/sign/user-files/ebooks/:id.epub?token=:token'
        }]
    },
}

const withMDX = createMDX({})

export default withSerwist(withMDX(nextConfig))
