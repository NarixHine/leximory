import 'server-only'
import { z } from 'zod'
import { streamText } from 'ai'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import { definitionSchema } from '@repo/api'
import { PLANS, PLAN_COMMENTARY_QUOTA, ACTION_QUOTA_COST } from '@repo/env/config'
import { getLanguageName } from '@repo/languages'
import { revalidateTag } from 'next/cache'
import { instruction } from '@/lib/prompt'
import { nanoAI } from '@/server/ai/config'
import { receiptSchema, type DefinitionServices } from './definitions'
import { MobileError } from './errors'

export const definitionServices: DefinitionServices = {
    async preferences(subject) {
        const { data } = await supabase.from('users').select('plan,accent').eq('id', subject.userId).maybeSingle().throwOnError()
        const plan = z.enum(PLANS).parse(data?.plan ?? 'beginner')
        return { accent: data?.accent ?? '', limit: PLAN_COMMENTARY_QUOTA[plan] }
    },
    async cached(key) {
        const value = await redis.get(`mobile:definition:v1:${key}`)
        return value === null ? null : definitionSchema.parse(value)
    },
    async cache(key, definition) { await redis.set(`mobile:definition:v1:${key}`, definition, { ex: 86400 }) },
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
            ...nanoAI, abortSignal: signal, maxOutputTokens: 800,
            instructions: `${instruction[language]}\n只注解上下文中被 [[ ]] 标出的一个完整语块。语境义与解释使用中文。只输出一个 {{原文形式||原形||语境释义||词源||同源词}}，没有词源或同源词时省略相应末尾字段，不输出空字段、代码围栏或其他文字。${language === 'en' ? `用户偏好：${accent}。` : ''}`,
            prompt: context,
        })
        for await (const delta of textStream) yield delta
    },
    async complete(id, receipt) { await redis.set(`mobile:completion:${id}`, receipt, { ex: 3600 }) },
    async receipt(id) {
        const value = await redis.get(`mobile:completion:${id}`)
        return value === null ? null : receiptSchema.parse(value)
    },
    async save(subject, sourceLibrary, language, definition) {
        const { data: source } = await supabase.from('libraries').select('owner').eq('id', sourceLibrary).maybeSingle().throwOnError()
        if (!source) throw new MobileError('inaccessible')
        let destination = sourceLibrary
        if (source.owner !== subject.userId) {
            const { data: shadow } = await supabase.from('libraries').select('id').eq('owner', subject.userId).eq('shadow', true).eq('lang', language).order('id').limit(1).maybeSingle().throwOnError()
            if (shadow) destination = shadow.id
            else {
                const { data } = await supabase.from('libraries').insert({ owner: subject.userId, shadow: true, name: `🗃️ ${getLanguageName(language)}词汇仓库`, lang: language }).select('id').single().throwOnError()
                destination = data.id
            }
        }
        const fields = [definition.lemma, definition.lemma, definition.definition, definition.etymology, definition.cognates].filter(value => value !== null)
        if (fields.some(value => value.includes('||') || /[{}]/.test(value))) throw new MobileError('invalid_input')
        const word = `{{${fields.join('||').replaceAll('\n', '')}}}`
        const { data } = await supabase.from('lexicon').insert({ lib: destination, word }).select('id').single().throwOnError()
        revalidateTag(`words:${destination}`, { expire: 0 }); revalidateTag('words', { expire: 0 })
        return { id: data.id, libraryId: destination }
    },
}
