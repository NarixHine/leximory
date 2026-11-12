import 'server-only'
import { randomUUID } from 'node:crypto'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { catalogStore } from '../store'
import { ebookStore } from '../ebook-store'
import { definitionServices } from '../definition-services'
import { chargeCommentaryQuota } from '../quota-store'
import { createEbookAnnotationStore } from '../ebook-annotation-store'
import { createEbookAnnotationOperations } from '../ebook-annotations'
import { streamEbookAnnotations } from '../ebook-annotation-generation'

const operations = createEbookAnnotationOperations({
    catalog: catalogStore,
    ebooks: ebookStore,
    definitions: definitionServices,
    store: createEbookAnnotationStore(supabase),
    generator: {
        async lock(id) {
            const key = `mobile:ebook-annotation-lock:${id}`,
                token = randomUUID()
            if (!(await redis.set(key, token, { nx: true, ex: 180 }))) return null
            return async () => {
                await redis.eval(
                    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
                    [key],
                    [token],
                )
            }
        },
        charge: (userId, limit, unitId, cost) =>
            chargeCommentaryQuota({
                userId,
                limit,
                cost,
                requestId: `ebook-annotation-${unitId}`,
                durableReceipt: true,
            }),
        async *generate(text, language, accent, signal, unitId) {
            yield* streamEbookAnnotations({ text, language, accent, signal, requestId: unitId })
        },
    },
})
export const ebookAnnotations = mobileEndpoint(verify, operations.ebookAnnotations, 120000)
export const ebookAnnotationVocabulary = mobileEndpoint(verify, operations.ebookAnnotationVocabulary, 60000)
