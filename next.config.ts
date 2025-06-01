import createMDX from '@next/mdx'
import withSerwistInit from '@serwist/next'
import { NextConfig } from 'next'
import { fixYourPaperBlogLink } from './lib/config'

const nextConfig: NextConfig = {
    experimental: {
        mdxRs: true,
        ppr: 'incremental',
        serverActions: {
            bodySizeLimit: '4.5mb',
        },
        useCache: true,
    },
    turbopack: {},
    pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
    async redirects() {
        return [{
            source: '/try',
            destination: '/read',
            permanent: true,
        }, {
            source: '/fix',
            destination: fixYourPaperBlogLink,
            permanent: true,
        }, {
            source: '/library/chat',
            destination: '/blog/ai-agent',
            permanent: true,
        }]
    },
    async rewrites() {
        return [{
            source: '/ebooks/:id\\.epub',
            destination: 'https://us-east-1.storage.xata.sh/:id'
        }]
    },
}

const withSerwist = withSerwistInit({
    swSrc: 'app/sw.ts',
    swDest: 'public/sw.js',
})

const withMDX = createMDX({})

export default withSerwist(withMDX(nextConfig))
