import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Leximory',
        short_name: 'Leximory',
        display_override: ['standalone', 'minimal-ui'],
        theme_color: '#FFFCF0',
        background_color: '#FFFCF0',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['utilities', 'education'],
        description: '从记忆到心会',
    }
}
