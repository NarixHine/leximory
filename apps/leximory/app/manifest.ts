import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Leximory',
        short_name: 'Leximory',
        display_override: ['standalone', 'minimal-ui'],
        theme_color: '#ffffff',
        background_color: '#ffffff',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['utilities', 'education'],
        description: '从记忆到心会',
    }
}
