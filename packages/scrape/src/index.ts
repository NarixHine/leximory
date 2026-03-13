import 'server-only'
import { Defuddle } from 'defuddle/node'
import { JSDOM } from 'jsdom'

/**
 * Extracts an article from a given URL using Defuddle.
 * 
 * @param url - The URL of the article to extract.
 * @returns An object containing the title and content of the article.
 */
export async function extractArticleFromUrl(url: string) {
    const dom = await JSDOM.fromURL(url)
    const result = await Defuddle(dom, url, {
        markdown: true,
    })
    const { content, title, site } = result
    return { title: title || site || 'Untitled', content }
}
