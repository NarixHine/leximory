import { randomUUID } from 'node:crypto'
import { shortcutWordSchema, shortcutWordResultSchema } from '@repo/api'
import { getLanguageName } from '@repo/languages'
import type { z } from 'zod'
import type { MobileSubject } from '@repo/schema/mobile'
import type { BrowserStore } from './browser'
import type { DefinitionServices } from './definitions'
import { prepareDefinition } from './definition-generation'
import { jsonBody, query, checkedResponse, type MobileOperation } from './http'

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
}) {
    return {
        saveShortcutWord: async ({ request, subject, signal }) => {
            query(request, [])
            const { word, requestId } = shortcutWordSchema.parse(await jsonBody(request, 16384, signal))
            const lease = randomUUID()
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
                const libraryId = await dependencies.shadowLibrary(subject, language)
                signal.throwIfAborted()
                const receipt = await dependencies.definitions.save(subject, libraryId, language, definition, requestId)
                const result = checkedResponse(shortcutWordResultSchema, {
                    ...receipt,
                    language,
                    libraryName: getLanguageName(language) + '词汇仓库',
                })
                await dependencies.shortcuts.complete(subject, requestId, word, result, lease)
                return result
            } finally {
                await dependencies.shortcuts.release(subject, requestId, lease)
            }
        },
    } satisfies Record<string, MobileOperation>
}
