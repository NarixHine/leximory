import 'server-only'
import { streamText, type LanguageModel } from 'ai'
import type { Lang } from '@repo/schema/library'
import { commentSyntaxRegex, parseWord } from '@repo/utils/comment'
import { annotationPrompt } from '../ai/annotation-prompt'
import { parseGeneratedDefinition } from './definitions'
import { MobileError } from './errors'
import type { GeneratedEbookAnnotation } from './ebook-annotations'

export async function* streamEbookAnnotations(input: {
    model?: LanguageModel
    text: string
    language: Lang
    accent: string
    signal: AbortSignal
}): AsyncGenerator<GeneratedEbookAnnotation> {
    const config = annotationPrompt({
        lang: input.language,
        input: input.text,
        autoTrim: false,
        accentPrompt:
            input.language === 'en' ? `用户偏好：${input.accent}。请使用${input.accent}拼写、发音和语汇。` : '',
    })
    const abort = new AbortController()
    const result = streamText({
        ...config,
        ...(input.model ? { model: input.model } : {}),
        abortSignal: AbortSignal.any([input.signal, abort.signal]),
    })
    let pending = '',
        sourceOffset = 0,
        received = 0
    const syntax = new RegExp(commentSyntaxRegex)
    try {
        for await (const delta of result.textStream) {
            input.signal.throwIfAborted()
            received += delta.length
            if (received > 512000) throw new MobileError('service_unavailable')
            pending += delta
            while (true) {
                const match = pending.matchAll(syntax).next().value
                if (!match) break
                const quote = parseWord(match[0])[0]
                if (!quote) throw new MobileError('service_unavailable')
                const prefix = pending.slice(0, match.index).trimStart()
                const fragment = input.text.indexOf(prefix + quote, sourceOffset)
                let start = fragment < 0 ? input.text.indexOf(quote, sourceOffset) : fragment + prefix.length
                // Rewritten context cannot safely identify a repeated word.
                if (fragment < 0 && start >= 0 && input.text.indexOf(quote, start + 1) >= 0) start = -1
                const definition = parseGeneratedDefinition(match[0])
                if (start >= 0) {
                    let occurrence = 0,
                        offset = -1
                    do {
                        offset = input.text.indexOf(quote, offset + 1)
                        occurrence++
                    } while (offset < start)
                    sourceOffset = start + quote.length
                    yield { quote, occurrence, definition }
                }
                pending = pending.slice(match.index + match[0].length)
            }
        }
        if (pending.includes('{{') || (await result.finishReason) !== 'stop')
            throw new MobileError('service_unavailable')
    } finally {
        abort.abort()
    }
}
