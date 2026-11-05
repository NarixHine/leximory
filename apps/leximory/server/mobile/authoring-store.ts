import { chargeCommentaryQuota } from './quota-store'
import { getMembership } from '@repo/user/membership'
import 'server-only'
import { extractArticleFromUrl } from '@repo/scrape'
import { languageWelcomeWords } from '@repo/languages'
import { assertPublicArticleURL } from './article-url'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import { invalidateMutationCaches, mutationEffects } from './mutation-effects'
import { PLAN_COMMENTARY_QUOTA, ACTION_QUOTA_COST } from '@repo/env/config'
import { createText, deleteText, uploadEbook, updateText, setTextAnnotationProgress } from '@/server/db/text'
import { emojiChoice } from '@/server/ai/emoji'
import { runEvaluation } from '@/server/ai/evaluate'
import { publishArticleImport } from '@/server/inngest/client'
import { MobileError } from './errors'
import type { AuthoringStore } from './authoring'
import { serializeWord } from './word-format'
import { createArticleImporter } from './article-import-store'

const importArticle = createArticleImporter({
    effects: mutationEffects,
    database: supabase,
    charge: (userId, requestId) => charge({ userId }, ACTION_QUOTA_COST.articleAnnotation, requestId),
    accepted: {
        get: (id) => redis.get('mobile:article-import:' + id),
        set: async (id) => {
            await redis.set('mobile:article-import:' + id, id, { ex: 604800 })
        },
    },
    markPending: (id) => setTextAnnotationProgress({ id, progress: 'annotating' }),
    enqueue: async (event) => {
        await publishArticleImport(event)
    },
})

function expireWords(library: string) {
    invalidateMutationCaches(`words:${library}`)
    invalidateMutationCaches('words')
}
function parseWord(data: { id: string; lib: string | null; word: string; created_at?: string | null }) {
    if (!data.lib) throw new MobileError('inaccessible')
    const fields = /^\{\{([\s\S]*)\}\}$/.exec(data.word)?.[1]?.split('||')
    if (!fields || fields.length < 3) throw new MobileError('unsupported_format')
    return {
        id: data.id,
        libraryId: data.lib,
        createdAt: data.created_at ?? null,
        protected: Object.values(languageWelcomeWords).includes(data.word),
        fields: {
            original: fields[0]!,
            lemma: fields[1]!,
            definition: fields[2]!,
            etymology: fields[3] || null,
            cognates: fields[4] || null,
        },
    }
}
export const authoringStore: AuthoringStore = {
    async extract(url) {
        await assertPublicArticleURL(url)
        const article = await extractArticleFromUrl(url, assertPublicArticleURL)
        return { title: article.title, content: article.content.replace(/(?<!\!)\[([^\[]+)\]\(([^)]+)\)/g, '$1') }
    },
    async words(libraryId, cursor) {
        const offset = Number(cursor ?? 0)
        const { data } = await supabase
            .from('lexicon')
            .select('id,lib,word,created_at')
            .eq('lib', libraryId)
            .order('created_at', { ascending: false })
            .order('id')
            .range(offset, offset + 40)
            .throwOnError()
        return { items: data.slice(0, 40).map(parseWord), nextCursor: data.length > 40 ? String(offset + 40) : null }
    },
    async word(id) {
        const { data } = await supabase
            .from('lexicon')
            .select('id,lib,word,created_at')
            .eq('id', id)
            .maybeSingle()
            .throwOnError()
        if (!data?.lib) return null
        return parseWord(data)
    },
    async updateWord(id, library, fields) {
        await supabase
            .from('lexicon')
            .update({ word: serializeWord(fields) })
            .eq('id', id)
            .eq('lib', library)
            .select('id')
            .single()
            .throwOnError()
        expireWords(library)
        invalidateMutationCaches(id)
    },
    async article(subject, library, input) {
        const text = await importArticle(subject, library, input)
        invalidateMutationCaches(`texts:${library.id}`)
        return text
    },
    async ebook(library, title, file) {
        const id = await createText({ lib: library.id, title })
        try {
            await uploadEbook({ id, ebook: file })
        } catch (error) {
            await supabase.storage.from('user-files').remove([`ebooks/${id}.epub`, `ebooks/${id}.pdf`])
            await deleteText({ id })
            throw error
        }
        invalidateMutationCaches(`texts:${library.id}`)
        return {
            id,
            libraryId: library.id,
            title,
            topics: [],
            emoji: null,
            createdAt: new Date().toISOString(),
            format: 'ebook',
        }
    },
    async chooseEbookEmoji(subject, input, signal) {
        await charge(subject, ACTION_QUOTA_COST.evaluation)
        const { answers } = await runEvaluation({ ...emojiChoice(input), abortSignal: signal })
        return answers.emoji.choice
    },
    async setEbookEmoji(id, emoji) {
        const libraryId = await updateText({ id, emoji })
        invalidateMutationCaches(`texts:${libraryId}`)
        invalidateMutationCaches(id)
    },
}

async function charge(subject: { userId: string }, cost: number, requestId?: string) {
    const { plan } = await getMembership(subject.userId)
    const limit = PLAN_COMMENTARY_QUOTA[plan]
    const allowed = await chargeCommentaryQuota({ userId: subject.userId, cost, limit, requestId })
    if (!allowed) throw new MobileError('quota_exceeded')
}
