import { z } from 'zod'
import { homePinSchema, homePinSaveRequest, homePinSaveSchema, homePinsPageSchema, homePinsRequest } from '@repo/api'
import { browserURL } from './browser'
import { jsonOperation } from './http'
import { MobileError } from './errors'

export type HomePin = z.infer<typeof homePinSchema>
export type HomePinSave = z.infer<typeof homePinSaveSchema>
export interface HomePinsStore {
    list(userId: string, cursor: string | undefined, signal: AbortSignal): Promise<z.infer<typeof homePinsPageSchema>>
    save(userId: string, pinId: string, input: HomePinSave, signal: AbortSignal): Promise<HomePin | null>
}

export function createHomePinsOperations(store: HomePinsStore) {
    return {
        homePins: jsonOperation(
            { input: homePinsRequest, output: homePinsPageSchema },
            ({ query }, { subject, signal }) => store.list(subject.userId, query.cursor, signal),
        ),
        saveHomePin: jsonOperation(
            { input: homePinSaveRequest, output: homePinSchema, bodyLimit: 32768 },
            async ({ params, body: input }, { subject, signal }) => {
                if (input.expectedRevision === input.revision) throw new MobileError('invalid_input')
                if (input.destination.kind === 'webpage') input.destination.url = browserURL(input.destination.url).href
                else if (input.destination.text.bookmarkURL) {
                    input.destination.text.bookmarkURL = browserURL(input.destination.text.bookmarkURL).href
                }
                if (input.faviconURL) input.faviconURL = browserURL(input.faviconURL).href
                // The destination is a display snapshot. Opening it still uses normal resource authorization.
                const saved = await store.save(subject.userId, params.pinId, input, signal)
                if (!saved) throw new MobileError('stale_revision')
                return saved
            },
        ),
    }
}
