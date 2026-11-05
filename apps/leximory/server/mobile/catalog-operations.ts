import {
    resourceID,
    accountSchema,
    librariesSchema,
    textsSchema,
    documentSchema,
    audioSchema,
    pageInput,
} from '@repo/api'
import type { z } from 'zod'
import type { MobileSubject } from '@repo/schema/mobile'
import { createCatalog, type CatalogStore } from './catalog'
import { query, checkedResponse, type MobileOperation } from './http'

export function createCatalogOperations(dependencies: {
    store: CatalogStore
    account: (subject: MobileSubject, signal: AbortSignal) => Promise<z.infer<typeof accountSchema>>
}) {
    const catalog = createCatalog(dependencies.store)
    return {
        me: async ({ request, subject, signal }) => {
            query(request, [])
            return checkedResponse(accountSchema, await dependencies.account(subject, signal))
        },
        libraries: async ({ request, subject, signal }) => {
            const { cursor } = pageInput.parse(query(request, ['cursor']))
            return checkedResponse(librariesSchema, await catalog.libraries(subject, cursor, signal))
        },
        texts: async ({ request, subject, signal, params }) => {
            const { cursor } = pageInput.parse(query(request, ['cursor']))
            return checkedResponse(
                textsSchema,
                await catalog.texts(subject, resourceID.parse(params.libraryId), cursor, signal),
            )
        },
        document: async ({ request, subject, signal, params }) => {
            query(request, [])
            return checkedResponse(
                documentSchema,
                await catalog.document(subject, resourceID.parse(params.textId), signal),
            )
        },
        audio: async ({ request, subject, signal, params }) => {
            query(request, [])
            return checkedResponse(
                audioSchema,
                await catalog.audio(subject, resourceID.parse(params.textId), resourceID.parse(params.audioId), signal),
            )
        },
    } satisfies Record<string, MobileOperation>
}
