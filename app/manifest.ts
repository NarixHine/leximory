import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Leximory',
        short_name: 'Leximory',
        display_override: ['standalone', 'minimal-ui'],
        icons: [
            {
                src: '/android-chrome-192x192.png',
                sizes: '192x192',
                type: 'image/png'
            },
            {
                src: '/android-chrome-512x512.png',
                sizes: '512x512',
                type: 'image/png'
            }
        ],
        theme_color: '#FFFCF0',
        background_color: '#FFFCF0',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['utilities', 'education'],
        description: '从记忆到心会',
        screenshots: [
            {
                src: '/screenshots/wide.png',
                sizes: '2736x1728',
                type: 'image/png',
                form_factor: 'wide',
            },
            {
                src: '/screenshots/narrow.png',
                sizes: '1062x1182',
                type: 'image/png',
            },
        ],
    }
}
