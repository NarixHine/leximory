import { chargeCommentaryQuota } from './quota-store'
import { serializeWord } from './word-format'
import { checkedResponse } from './http'
import { shadowLibrary } from './shadow-library'
import 'server-only'
import { getMembership } from '@repo/user/membership'
import { streamText } from 'ai'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import { definitionSchema } from '@repo/api'
import { PLAN_COMMENTARY_QUOTA, ACTION_QUOTA_COST } from '@repo/env/config'
import { revalidateTag } from 'next/cache'
import { mobileWordGuide } from '@/lib/prompt'
import { wordAI } from '@/server/ai/config'
import { receiptSchema, type DefinitionServices } from './definitions'
import { MobileError } from './errors'
import { saveVocabularyOnce } from './vocabulary-save'

export const definitionServices: DefinitionServices = {
    async preferences(subject) {
        const { data } = await supabase
            .from('users')
            .select('accent')
            .eq('id', subject.userId)
            .maybeSingle()
            .throwOnError()
        const { plan } = await getMembership(subject.userId)
        return { accent: data?.accent ?? '', limit: PLAN_COMMENTARY_QUOTA[plan] }
    },
    async cached(key) {
        const value = await redis.get(`mobile:definition:v3:${key}`)
        return value === null ? null : checkedResponse(definitionSchema, value)
    },
    async cache(key, definition) {
        await redis.set(`mobile:definition:v3:${key}`, definition, { ex: 86400 })
    },
    charge: (subject, limit, requestId) =>
        chargeCommentaryQuota({ userId: subject.userId, cost: ACTION_QUOTA_COST.wordAnnotation, limit, requestId }),
    async *generate(context, language, accent, signal) {
        const { textStream } = streamText({
            ...wordAI,
            abortSignal: signal,
            maxOutputTokens: 800,
            instructions: `${mobileWordGuide(language)}\n只注解上下文中被 [[ ]] 标出的一个完整语块。语境义与解释使用中文。只输出一个 {{原文形式||原形||语境释义||词源||同源词}}，没有词源或同源词时省略相应末尾字段，不输出空字段、代码围栏或其他文字。${language === 'en' ? `用户偏好：${accent}。` : ''}`,
            prompt: context,
        })
        for await (const delta of textStream) yield delta
    },
    async complete(id, receipt) {
        await redis.set(`mobile:completion:${id}`, receipt, { ex: 3600 })
    },
    async receipt(id) {
        const value = await redis.get(`mobile:completion:${id}`)
        return value === null ? null : checkedResponse(receiptSchema, value)
    },
    async save(subject, sourceLibrary, language, definition, requestId) {
        const { data: source } = await supabase
            .from('libraries')
            .select('owner')
            .eq('id', sourceLibrary)
            .maybeSingle()
            .throwOnError()
        if (!source) throw new MobileError('inaccessible')
        const word = serializeWord({ original: definition.lemma, ...definition })
        const sourceOwner = source.owner
        async function destination() {
            return sourceOwner === subject.userId ? sourceLibrary : shadowLibrary(subject, language)
        }
        const saved = await saveVocabularyOnce(
            { userId: subject.userId, sourceLibrary, requestId },
            {
                destination,
                async lookup(id) {
                    const { data } = await supabase
                        .from('lexicon')
                        .select('id,lib')
                        .eq('id', id)
                        .maybeSingle()
                        .throwOnError()
                    if (!data?.lib) return null
                    const { data: library } = await supabase
                        .from('libraries')
                        .select('owner')
                        .eq('id', data.lib)
                        .maybeSingle()
                        .throwOnError()
                    return { id: data.id, libraryId: data.lib, owner: library?.owner ?? null }
                },
                async insertIfAbsent(id, libraryId) {
                    await supabase
                        .from('lexicon')
                        .upsert({ id, lib: libraryId, word }, { onConflict: 'id', ignoreDuplicates: true })
                        .throwOnError()
                },
            },
        )
        revalidateTag(`words:${saved.libraryId}`, { expire: 0 })
        revalidateTag('words', { expire: 0 })
        return saved
    },
}
