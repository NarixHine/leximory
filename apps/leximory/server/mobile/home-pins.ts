import { z } from 'zod'
import { homePinSchema, homePinSaveSchema, homePinsPageSchema } from '@repo/api'
import { browserURL } from './browser'
import { checkedResponse, jsonBody, query, type MobileOperation } from './http'
import { MobileError } from './errors'

export type HomePin = z.infer<typeof homePinSchema>
export type HomePinSave = z.infer<typeof homePinSaveSchema>
export interface HomePinsStore {
    list(userId: string, cursor: string | undefined, signal: AbortSignal): Promise<z.infer<typeof homePinsPageSchema>>
    save(userId: string, pinId: string, input: HomePinSave, signal: AbortSignal): Promise<HomePin | null>
}

export function createHomePinsOperations(store: HomePinsStore) {
    return {
        homePins: async ({ subject, request, signal }) => {
            const { cursor } = z.object({ cursor: z.uuid().toLowerCase().optional() }).parse(query(request, ['cursor']))
            return checkedResponse(homePinsPageSchema, await store.list(subject.userId, cursor, signal))
        },
        saveHomePin: async ({ subject, params, request, signal }) => {
            query(request, [])
            const pinId = z.uuid().toLowerCase().parse(params.pinId)
            const input = homePinSaveSchema.parse(await jsonBody(request, 32768, signal))
            if (input.expectedRevision === input.revision) throw new MobileError('invalid_input')
            if (input.destination.kind === 'webpage') input.destination.url = browserURL(input.destination.url).href
            else if (input.destination.text.bookmarkURL) {
                input.destination.text.bookmarkURL = browserURL(input.destination.text.bookmarkURL).href
            }
            if (input.faviconURL) input.faviconURL = browserURL(input.faviconURL).href
            // The destination is a display snapshot. Opening it still uses normal resource authorization.
            const saved = await store.save(subject.userId, pinId, input, signal)
            if (!saved) throw new MobileError('stale_revision')
            return checkedResponse(homePinSchema, saved)
        },
    } satisfies Record<string, MobileOperation>
}
