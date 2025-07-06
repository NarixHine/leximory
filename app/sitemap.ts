import { MetadataRoute } from 'next'
import { getAllTimesData } from '@/server/db/times'
import { prefixUrl } from '@/lib/config'
import { postsData } from './blog/posts'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticPages = [
        {
            url: prefixUrl('/'),
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 1,
        },
        {
            url: prefixUrl('/times'),
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.9,
        },
        {
            url: prefixUrl('/about'),
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: prefixUrl('/library'),
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        },
        {
            url: prefixUrl('/blog'),
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.6,
        },
    ] satisfies MetadataRoute.Sitemap

    // Generate Times issue pages
    const timesData = await getAllTimesData()
    const timesPages = timesData.map((issue) => ({
        url: prefixUrl(`/times?date=${issue.date}`),
        lastModified: new Date(issue.date),
        changeFrequency: 'never' as const,
        priority: 0.8,
    })) satisfies MetadataRoute.Sitemap

    const blogPages = postsData.map((post) => ({
        url: prefixUrl(`/blog/${post.slug}`),
        lastModified: new Date(post.date),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
    })) satisfies MetadataRoute.Sitemap

    return [...staticPages, ...timesPages, ...blogPages]
}
