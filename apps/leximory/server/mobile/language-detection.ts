import 'server-only'
import { redis } from '@repo/kv/redis'
import { runEvaluation } from '@/server/ai/evaluate'
import { browserLanguageQuestion, parseBrowserLanguage } from './browser-language'
import { mobileMutationID } from './vocabulary-save'

export async function detectLanguage(context: string, quote: string) {
    const key = 'browser:language:v3:' + mobileMutationID(context, quote)
    const cached = await redis.get(key)
    if (cached) return parseBrowserLanguage(cached, quote)
    const result = await runEvaluation({
        state: { selectedText: quote, context: context.slice(0, 4000) },
        questions: { language: browserLanguageQuestion(quote) },
    })
    const language = parseBrowserLanguage(result.answers.language.choice, quote)
    await redis.set(key, language, { ex: 86400 })
    return language
}
