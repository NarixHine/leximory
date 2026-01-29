'use server'

import { extractArticleFromUrl } from '@repo/scrape'

export async function scrapeArticle(url: string) {
    return extractArticleFromUrl(url)
}
