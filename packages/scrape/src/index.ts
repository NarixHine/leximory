import 'server-only'
import Defuddle from 'defuddle'
import { parseHTML } from 'linkedom'

/**
 * Extracts an article from a given URL using Defuddle.
 * 
 * @param url - The URL of the article to extract.
 * @returns An object containing the title and content of the article.
 */
export async function extractArticleFromUrl(url: string) {
    const res = await fetch(url)
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status}`)
    }
    const html = await res.text()
    const { document } = parseHTML(html)
    const result = new Defuddle(document as unknown as Document, { url }).parse()
    const { content, title, site } = result
    return { title: title || site || 'Untitled', content }
}
