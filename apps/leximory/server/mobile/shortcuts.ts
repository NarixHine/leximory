import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { shortcutWordSchema, shortcutWordResultSchema } from '@repo/api'
import type { z } from 'zod'
import type { MobileSubject } from '@repo/schema/mobile'
import type { BrowserStore } from './browser'
import type { DefinitionServices } from './definitions'
import { prepareDefinition } from './definition-generation'
import { jsonBody, query, checkedResponse, type MobileOperation } from './http'
import { MobileError } from './errors'

export type ShortcutWordResult = z.infer<typeof shortcutWordResultSchema>
export interface ShortcutStore {
    begin(
        subject: MobileSubject,
        requestId: string,
        word: string,
        lease: string,
        signal: AbortSignal,
    ): Promise<ShortcutWordResult | null>
    complete(
        subject: MobileSubject,
        requestId: string,
        word: string,
        result: ShortcutWordResult,
        lease: string,
    ): Promise<void>
    release(subject: MobileSubject, requestId: string, lease: string): Promise<void>
}
export function createShortcutOperations(dependencies: {
    detectLanguage: BrowserStore['detectLanguage']
    shadowLibrary: BrowserStore['shadowLibrary']
    definitions: DefinitionServices
    shortcuts: ShortcutStore
    after: (work: () => Promise<void>) => void
}) {
    return {
        saveShortcutWord: async ({ request, subject, signal }) => {
            query(request, [])
            const { word, requestId } = shortcutWordSchema.parse(await jsonBody(request, 16384, signal))
            const lease = randomUUID()
            let deferred = false
            try {
                const saved = await dependencies.shortcuts.begin(subject, requestId, word, lease, signal)
                if (saved) return checkedResponse(shortcutWordResultSchema, saved)
                const context = '[[' + word + ']]'
                const language = await dependencies.detectLanguage(context, word)
                signal.throwIfAborted()
                const generate = await prepareDefinition(dependencies.definitions, {
                    subject,
                    language,
                    context,
                    cacheVersion: 'browser-definition-v1',
                    requestId,
                    signal,
                })
                const definition = await generate(signal)
                signal.throwIfAborted()
                const result = checkedResponse(shortcutWordResultSchema, {
                    language,
                    annotation: definition,
                })
                dependencies.after(async () => {
                    try {
                        for (let attempt = 0; ; attempt++) {
                            try {
                                const libraryId = await dependencies.shadowLibrary(subject, language)
                                await dependencies.definitions.save(subject, libraryId, language, definition, requestId)
                                await dependencies.shortcuts.complete(subject, requestId, word, result, lease)
                                break
                            } catch (error) {
                                if (attempt >= 2 || (error instanceof MobileError && !error.body.error.retryable))
                                    throw error
                                await delay(250 * 2 ** attempt)
                            }
                        }
                    } finally {
                        await dependencies.shortcuts.release(subject, requestId, lease)
                    }
                })
                deferred = true
                return result
            } finally {
                if (!deferred) await dependencies.shortcuts.release(subject, requestId, lease)
            }
        },
    } satisfies Record<string, MobileOperation>
}
