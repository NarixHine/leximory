import createMDX from '@next/mdx'
import withSerwistInit from '@serwist/next'
import remarkYoutube from 'remark-youtube'

/** @type {import('next').NextConfig} */
const nextConfig = {
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
            {
                source: '/hello-leximory-hi-pxci',
                destination: '/blog/summer-hackathon',
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
            {
                source: '/stats/:match*',
                destination: 'https://cloud.umami.is/:match*',
            },
        ]
    },
}

const withSerwist = withSerwistInit({
    swSrc: 'app/sw.ts',
    swDest: 'public/sw.js',
})

const withMDX = createMDX({
    options: {
        remarkPlugins: [remarkYoutube],
    },
})

export default withSerwist(withMDX(nextConfig))
