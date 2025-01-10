import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Leximory',
        short_name: 'Leximory',
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
        theme_color: '#FAFDF6',
        background_color: '#FAFDF6',
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
