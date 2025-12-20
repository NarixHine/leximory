import createMDX from '@next/mdx'
import withSerwistInit from '@serwist/next'
import { NextConfig } from 'next'
import { ALLOWED_IMAGE_REMOTE_PATTERNS, FYP_BLOG_LINK } from './lib/config'
import env from '@/lib/env'

const r2Url = new URL(env.R2_PUBLIC_URL)

const nextConfig: NextConfig = {
    cacheComponents: true,
    experimental: {
        mdxRs: true,
        serverActions: {
            bodySizeLimit: '4.5mb',
        },
    },
    serverExternalPackages: ['pdf-parse'],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'pcsjszvydprmevipvpva.supabase.co',
            },
            {
                protocol: r2Url.protocol.slice(0, -1) as 'http' | 'https',
                hostname: r2Url.hostname
            },
            ...ALLOWED_IMAGE_REMOTE_PATTERNS
        ],
    },
    turbopack: {},
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

const withSerwist = withSerwistInit({
    swSrc: 'app/sw.ts',
    swDest: 'public/sw.js',
})

const withMDX = createMDX({})

export default withSerwist(withMDX(nextConfig))
