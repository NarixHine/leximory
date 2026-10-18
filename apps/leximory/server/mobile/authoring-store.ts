import { chargeCommentaryQuota } from './quota-store'
import { getMembership } from '@repo/user/membership'
import 'server-only'
import { extractArticleFromUrl } from '@repo/scrape'
import { languageWelcomeWords } from '@repo/languages'
import { assertPublicArticleURL } from './article-url'
import { supabase } from '@repo/supabase'
import { revalidateTag } from 'next/cache'
import { PLAN_COMMENTARY_QUOTA, ACTION_QUOTA_COST } from '@repo/env/config'
import { createText, deleteText, uploadEbook, updateText, setTextAnnotationProgress } from '@/server/db/text'
import { emojiChoice } from '@/server/ai/emoji'
import { runEvaluation } from '@/server/ai/evaluate'
import { inngest } from '@/server/inngest/client'
import { MobileError } from './errors'
import type { AuthoringStore } from './authoring'
import { serializeWord } from './word-format'

function expireWords(library: string) {
    revalidateTag(`words:${library}`, { expire: 0 })
    revalidateTag('words', { expire: 0 })
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
        revalidateTag(id, { expire: 0 })
    },
    async article(subject, library, input) {
        if (input.annotate) {
            await charge(subject, ACTION_QUOTA_COST.articleAnnotation)
        }
        const id = await createText({ lib: library.id, title: input.title, content: input.content })
        try {
            if (input.annotate) {
                await setTextAnnotationProgress({ id, progress: 'annotating' })
                await inngest.send({
                    name: 'app/article.imported',
                    data: {
                        article: input.content,
                        userId: subject.userId,
                        textId: id,
                        onlyComments: input.onlyComments,
                        generateTitle: input.generateTitle,
                    },
                })
            }
        } catch (error) {
            await deleteText({ id })
            throw error
        }
        revalidateTag(`texts:${library.id}`, { expire: 0 })
        return {
            id,
            libraryId: library.id,
            title: input.title,
            topics: [],
            emoji: null,
            createdAt: new Date().toISOString(),
            format: 'article',
        }
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
        revalidateTag(`texts:${library.id}`, { expire: 0 })
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
        revalidateTag(`texts:${libraryId}`, { expire: 0 })
        revalidateTag(id, { expire: 0 })
    },
}

async function charge(subject: { userId: string }, cost: number) {
    const { plan } = await getMembership(subject.userId)
    const limit = PLAN_COMMENTARY_QUOTA[plan]
    const allowed = await chargeCommentaryQuota({ userId: subject.userId, cost, limit })
    if (!allowed) throw new MobileError('quota_exceeded')
}
