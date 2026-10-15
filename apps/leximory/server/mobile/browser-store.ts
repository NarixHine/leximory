import { checkedResponse } from './http'
import { detectLanguage } from './language-detection'
import { shadowLibrary } from './shadow-library'
import 'server-only'
import { generateText } from 'ai'
import { Parser } from 'htmlparser2'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import { revalidateTag } from 'next/cache'
import { emojiPrompt } from '@/server/ai/text-metadata'
import { isValidEmoji } from '@/lib/utils'
import { assertPublicArticleURL } from './article-url'
import { browserReceiptSchema, browserURL, type BrowserStore } from './browser'
import { mobileMutationID } from './vocabulary-save'
import { MobileError } from './errors'
import { summarizeText, textRowSchema } from './catalog'

async function metadata(input: string): Promise<{ title: string; emoji: string }> {
    let title = browserURL(input).hostname
    let description = ''
    const signal = AbortSignal.timeout(12000)
    try {
        let url = input
        for (let redirects = 0; redirects <= 5; redirects++) {
            await assertPublicArticleURL(url)
            const response = await fetch(url, { redirect: 'manual', signal, cache: 'no-store' })
            const location = response.headers.get('location')
            if (response.status >= 300 && response.status < 400 && location) {
                await response.body?.cancel()
                url = new URL(location, url).href
                continue
            }
            if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
                await response.body?.cancel()
                break
            }
            const reader = response.body?.getReader()
            if (!reader) break
            const chunks: Uint8Array[] = []
            let size = 0
            try {
                while (size < 262144) {
                    const { value, done } = await reader.read()
                    if (done) break
                    const chunk = value.subarray(0, 262144 - size)
                    chunks.push(chunk)
                    size += chunk.length
                }
            } finally {
                await reader.cancel()
                reader.releaseLock()
            }
            let inTitle = false
            let documentTitle = ''
            let socialTitle = ''
            const parser = new Parser(
                {
                    onopentag(name, attributes) {
                        if (name === 'title') inTitle = true
                        if (name === 'meta') {
                            const property = attributes.property ?? attributes.name
                            if (property === 'og:title') socialTitle = attributes.content ?? ''
                            if (property === 'description' || property === 'og:description')
                                description = attributes.content ?? ''
                        }
                    },
                    ontext(text) {
                        if (inTitle) documentTitle += text
                    },
                    onclosetag(name) {
                        if (name === 'title') inTitle = false
                    },
                },
                { decodeEntities: true },
            )
            parser.end(Buffer.concat(chunks).toString('utf8'))
            title = (socialTitle || documentTitle || title).replace(/\s+/g, ' ').trim().slice(0, 512) || title
            break
        }
    } catch {
        /* Metadata is optional; keep the hostname fallback. */
    }
    let emoji = '🌐'
    if (!signal.aborted) {
        try {
            const result = await generateText({ ...emojiPrompt(title + '\n' + description), abortSignal: signal })
            const selected = result.text.trim()
            if (isValidEmoji(selected)) emoji = selected
        } catch {
            /* A saved URL never depends on AI availability. */
        }
    }
    return { title, emoji }
}

export const browserStore: BrowserStore = {
    detectLanguage,
    async rules(userId) {
        const { data } = await supabase
            .from('browser_domain_rules')
            .select('domain,library_id')
            .eq('user_id', userId)
            .order('domain')
            .throwOnError()
        return data.map((row) => ({ domain: row.domain, libraryId: row.library_id }))
    },
    async setRule(userId, domain, libraryId) {
        if (libraryId)
            await supabase
                .from('browser_domain_rules')
                .upsert({ user_id: userId, domain, library_id: libraryId }, { onConflict: 'user_id,domain' })
                .throwOnError()
        else
            await supabase
                .from('browser_domain_rules')
                .delete()
                .eq('user_id', userId)
                .eq('domain', domain)
                .throwOnError()
    },
    async putReceipt(id, receipt) {
        await redis.set('browser:receipt:' + id, receipt, { ex: 3600 })
    },
    async receipt(id) {
        const data = await redis.get('browser:receipt:' + id)
        return data === null ? null : checkedResponse(browserReceiptSchema, data)
    },
    shadowLibrary,
    async bookmark(subject, library, input) {
        const id = mobileMutationID('bookmark', subject.userId, library.id, input.requestId)
        const existing = await supabase.from('texts').select('*').eq('id', id).maybeSingle().throwOnError()
        if (existing.data) {
            if (existing.data.lib !== library.id || existing.data.bookmark_url !== input.url)
                throw new MobileError('invalid_input')
            return summarizeText(checkedResponse(textRowSchema, existing.data))
        }
        const details = await metadata(input.url)
        const title = input.title ?? details.title
        const emoji = details.emoji
        await supabase
            .from('texts')
            .upsert(
                { id, lib: library.id, title, emoji, content: '', has_ebook: false, bookmark_url: input.url },
                { onConflict: 'id', ignoreDuplicates: true },
            )
            .throwOnError()
        const { data } = await supabase.from('texts').select('*').eq('id', id).single().throwOnError()
        if (data.lib !== library.id || data.bookmark_url !== input.url) throw new MobileError('invalid_input')
        revalidateTag('texts:' + library.id, { expire: 0 })
        revalidateTag('lib:' + library.id, { expire: 0 })
        return summarizeText(checkedResponse(textRowSchema, data))
    },
}
