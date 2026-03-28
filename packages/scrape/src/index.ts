import 'server-only'
import { Defuddle } from 'defuddle/node'
import { parseHTML } from 'linkedom'
import env from '@repo/env'
import { Tabstack } from '@tabstack/sdk'

/**
 * Extracts an article from a given URL without a remote service.
 * 
 * @param url - The URL of the article to extract.
 * @returns An object containing the title and content of the article.
 */
export async function defuddleUrl(url: string) {
    const html = await fetch(url).then(res => res.text())
    const { document } = parseHTML(html)
    const result = await Defuddle(document, url, {
        markdown: true,
        removeContentPatterns: true,
        removeImages: true,
        removePartialSelectors: true,
        removeSmallImages: true,
        removeHiddenElements: true,
        removeLowScoring: true
    })
    const { content, title, site } = result
    return { title: title || site || 'Untitled', content }
}

const tabs = new Tabstack({
    apiKey: env.TABSTACK_API_KEY
})

/**
 * Extracts an article from a given URL using the TabStack API.
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
