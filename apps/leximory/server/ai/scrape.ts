'use server'

import { SIGN_IN_URL } from '@repo/env/config'
import { extractArticleFromUrl } from '@repo/scrape'
import { Kilpi } from '@repo/service/kilpi'
import { redirect } from 'next/navigation'

export async function scrapeArticle(url: string) {
    const { granted } = await Kilpi.authed().authorize()
    if (!granted) {
        redirect(SIGN_IN_URL)
    }
    return extractArticleFromUrl(url)
}
