import 'server-only'
import { z } from 'zod'
import { streamText } from 'ai'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import { definitionSchema } from '@repo/api'
import { PLANS, PLAN_COMMENTARY_QUOTA, ACTION_QUOTA_COST } from '@repo/env/config'
import { getLanguageName } from '@repo/languages'
import { revalidateTag } from 'next/cache'
import { mobileWordGuide } from '@/lib/prompt'
import { wordAI } from '@/server/ai/config'
import { receiptSchema, type DefinitionServices } from './definitions'
import { MobileError } from './errors'
import { mobileMutationID, saveVocabularyOnce } from './vocabulary-save'

export const definitionServices: DefinitionServices = {
    async preferences(subject) {
        const { data } = await supabase.from('users').select('plan,accent').eq('id', subject.userId).maybeSingle().throwOnError()
        const plan = z.enum(PLANS).parse(data?.plan ?? 'beginner')
        return { accent: data?.accent ?? '', limit: PLAN_COMMENTARY_QUOTA[plan] }
    },
    async cached(key) {
        const value = await redis.get(`mobile:definition:v3:${key}`)
        return value === null ? null : definitionSchema.parse(value)
    },
    async cache(key, definition) { await redis.set(`mobile:definition:v3:${key}`, definition, { ex: 86400 }) },
    async charge(subject, limit) {
        // Same rolling quota and cost as the web; atomically refuse a charge that
        // would exceed the allowance, including simultaneous mobile requests.
        const allowed = await redis.eval(
            `local used = tonumber(redis.call('GET', KEYS[1]) or '0')
             local cost = tonumber(ARGV[1])
             if used + cost > tonumber(ARGV[2]) then return 0 end
             redis.call('INCRBYFLOAT', KEYS[1], cost)
             if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], 2592000) end
             return 1`,
            [`user:${subject.userId}:commentary_quota`], [ACTION_QUOTA_COST.wordAnnotation, limit],
        )
        if (allowed === 1) revalidateTag(`quota:${subject.userId}:commentary`, { expire: 0 })
        return allowed === 1
    },
    async *generate(context, language, accent, signal) {
        const { textStream } = streamText({
            ...wordAI, abortSignal: signal, maxOutputTokens: 800,
            instructions: `${mobileWordGuide(language)}\n只注解上下文中被 [[ ]] 标出的一个完整语块。语境义与解释使用中文。只输出一个 {{原文形式||原形||语境释义||词源||同源词}}，没有词源或同源词时省略相应末尾字段，不输出空字段、代码围栏或其他文字。${language === 'en' ? `用户偏好：${accent}。` : ''}`,
            prompt: context,
        })
        for await (const delta of textStream) yield delta
    },
    async complete(id, receipt) { await redis.set(`mobile:completion:${id}`, receipt, { ex: 3600 }) },
    async receipt(id) {
        const value = await redis.get(`mobile:completion:${id}`)
        return value === null ? null : receiptSchema.parse(value)
    },
    async save(subject, sourceLibrary, language, definition, requestId) {
        const { data: source } = await supabase.from('libraries').select('owner').eq('id', sourceLibrary).maybeSingle().throwOnError()
        if (!source) throw new MobileError('inaccessible')
        const fields = [definition.lemma, definition.lemma, definition.definition, definition.etymology, definition.cognates].filter(value => value !== null)
        if (fields.some(value => value.includes('||') || /[{}]/.test(value))) throw new MobileError('invalid_input')
        const word = `{{${fields.join('||').replaceAll('\n', '')}}}`
        const sourceOwner = source.owner
        async function destination() {
            if (sourceOwner === subject.userId) return sourceLibrary
            const { data: shadow } = await supabase.from('libraries').select('id').eq('owner', subject.userId).eq('shadow', true).eq('lang', language).order('id').limit(1).maybeSingle().throwOnError()
            if (shadow) return shadow.id
            const library = { owner: subject.userId, shadow: true, name: `🗃️ ${getLanguageName(language)}词汇仓库`, lang: language }
            if (requestId) {
                const id = mobileMutationID('shadow', subject.userId, language)
                await supabase.from('libraries').upsert({ ...library, id }, { onConflict: 'id', ignoreDuplicates: true }).throwOnError()
                const { data } = await supabase.from('libraries').select('id,owner,shadow,lang').eq('id', id).single().throwOnError()
                if (data.owner !== subject.userId || !data.shadow || data.lang !== language) throw new MobileError('inaccessible')
                return data.id
            }
            const { data } = await supabase.from('libraries').insert(library).select('id').single().throwOnError()
            return data.id
        }
        const saved = requestId ? await saveVocabularyOnce({ userId: subject.userId, sourceLibrary, requestId }, {
            destination,
            async lookup(id) {
                const { data } = await supabase.from('lexicon').select('id,lib').eq('id', id).maybeSingle().throwOnError()
                if (!data?.lib) return null
                const { data: library } = await supabase.from('libraries').select('owner').eq('id', data.lib).maybeSingle().throwOnError()
                return { id: data.id, libraryId: data.lib, owner: library?.owner ?? null }
            },
            async insertIfAbsent(id, libraryId) {
                await supabase.from('lexicon').upsert({ id, lib: libraryId, word }, { onConflict: 'id', ignoreDuplicates: true }).throwOnError()
            },
        }) : await (async () => {
            const libraryId = await destination()
            const { data } = await supabase.from('lexicon').insert({ lib: libraryId, word }).select('id').single().throwOnError()
            return { id: data.id, libraryId }
        })()
        revalidateTag(`words:${saved.libraryId}`, { expire: 0 }); revalidateTag('words', { expire: 0 })
        return saved
    },
}
