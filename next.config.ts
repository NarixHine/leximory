import createMDX from '@next/mdx'
import withSerwistInit from '@serwist/next'
import { NextConfig } from 'next'

const nextConfig: NextConfig = {
    experimental: {
        mdxRs: true,
        ppr: 'incremental',
        serverActions: {
            bodySizeLimit: '4mb',
        },
        useCache: true,
    },
    pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
    async redirects() {
        return [
            {
                source: '/try',
                destination: '/library/3e4f1126',
                permanent: true,
            },
            {
                source: '/intro',
                destination: '/blog/from-memorisation-to-acquisition',
                permanent: true,
            },
        ]
    },
    async rewrites() {
        return [
            {
                source: '/ebooks/:id\\.epub',
                destination: 'https://us-east-1.storage.xata.sh/:id'
            },
        ]
    },
}

const withSerwist = withSerwistInit({
    swSrc: 'app/sw.ts',
    swDest: 'public/sw.js',
})

const withMDX = createMDX({})

export default withSerwist(withMDX(nextConfig))
