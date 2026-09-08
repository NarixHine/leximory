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
        removeLowScoring: true,
    })
    const { content, title, site } = result
    return { title: title || site || 'Untitled', content }
}

const tabs = new Tabstack({
    apiKey: env.TABSTACK_API_KEY,
})

const MAX_ARTICLE_PAGES = 5

async function getNextArticlePage(url: string) {
    try {
        const response = await fetch(url)
        if (!response.ok) return undefined

        const html = await response.text()
        const { document } = parseHTML(html)
        const currentUrl = new URL(url)
        const candidates = Array.from(document.querySelectorAll('a, button, link[rel~="next"]'))
            .map((element, index) => {
                const href =
                    element.getAttribute('href') ||
                    element.getAttribute('data-href') ||
                    element.getAttribute('data-url')
                if (!href || href.startsWith('#')) return undefined

                const destination = new URL(href, currentUrl)
                if (destination.origin !== currentUrl.origin) return undefined

                const text = (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
                const attributes = [
                    element.getAttribute('rel'),
                    element.getAttribute('aria-label'),
                    element.getAttribute('title'),
                    element.getAttribute('class'),
                    element.getAttribute('id'),
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()

                if (/\b(prev(ious)?|back|share|print|comment|login|subscribe)\b/.test(`${text} ${attributes}`)) {
                    return undefined
                }

                const isNextText = /(^|\s)next(\s|$)/.test(text)
                const isNextAttribute =
                    /\bnext\b/.test(attributes) || /(^|\s)next(\s|$)/.test(element.getAttribute('rel') || '')
                const isContinuation = /continue|read\s+more/.test(text)
                const isPageUrl =
                    /page(?:=|[-_/])?\d+/.test(destination.href) || /(?:[?&])p(?:age)?=\d+/.test(destination.search)

                // Only follow links that look like pagination; otherwise a nearby site navigation link
                // can accidentally turn a single article into an unrelated multi-page document.
                if (!isNextText && !isNextAttribute && !isContinuation && !isPageUrl) return undefined

                let score = index / 1000
                if (isNextText) score -= 5
                if (/next\s+(page|article|story)/.test(text)) score -= 4
                if (isContinuation) score -= 2
                if (isNextAttribute) score -= 6
                if (isPageUrl) score -= 1

                return { score, url: destination.href }
            })
            .filter((candidate): candidate is { score: number; url: string } => Boolean(candidate))
            .sort((a, b) => a.score - b.score)

        return candidates[0]?.url
    } catch {
        return undefined
    }
}

/**
 * Extracts an article from a given URL using the TabStack API.
 *
 * @param url - The URL of the article to extract.
 * @returns An object containing the title and content of the article.
 */
export async function extractArticleFromUrl(url: string) {
    const pages = [url]
    const seenUrls = new Set([new URL(url).href])
    let currentUrl = url

    while (pages.length < MAX_ARTICLE_PAGES) {
        const nextUrl = await getNextArticlePage(currentUrl)
        if (!nextUrl || seenUrls.has(nextUrl)) break

        seenUrls.add(nextUrl)
        pages.push(nextUrl)
        currentUrl = nextUrl
    }

    const results = await Promise.all(
        pages.map(pageUrl =>
            tabs.extract.markdown({
                url: pageUrl,
                metadata: true,
            }),
        ),
    )
    const { metadata } = results[0]
    const { title, site_name } = metadata || {}
    return {
        title: title || site_name || 'Untitled',
        content: results.map(result => result.content).join('\n\n'),
    }
}
