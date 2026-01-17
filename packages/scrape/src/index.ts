import 'server-only'
import env from '@repo/env'
import { Tabstack } from '@tabstack/sdk'

const tabs = new Tabstack({
    apiKey: env.TABSTACK_API_KEY
})

/**
 * Extracts an article from a given URL using the Jina API.
 * 
 * @param url - The URL of the article to extract.
 * @returns An object containing the title and content of the article.
 */
export async function extractArticleFromUrl(url: string) {
    const result = await tabs.extract.markdown({
        url,
        metadata: true,
    })
    const { content, metadata } = result
    const { title, site_name } = metadata || {}
    return { title: title || site_name || 'Untitled', content }
}
