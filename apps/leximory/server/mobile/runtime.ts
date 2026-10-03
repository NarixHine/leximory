import 'server-only'
import env from '@repo/env'
import { revalidateTag } from 'next/cache'
import { PLANS, PLAN_COMMENTARY_QUOTA } from '@repo/env/config'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import { z } from 'zod'
import { createMobileHandler } from './handler'
import { createSupabaseBearerVerifier } from './auth'
import { catalogStore } from './store'

const verify = createSupabaseBearerVerifier({ url: env.SUPABASE_URL, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY })

const catalogGET = createMobileHandler({
    verify,
    store: catalogStore,
    async account(subject, signal) {
        const { data } = await supabase.from('users').select('plan').eq('id', subject.userId).abortSignal(signal).maybeSingle().throwOnError()
        const plan = z.enum(PLANS).parse(data?.plan ?? 'beginner')
        const key = `user:${subject.userId}:commentary_quota`
        const [used, resetsIn] = await Promise.all([redis.get<number>(key), redis.ttl(key)])
        signal.throwIfAborted()
        return { userId: subject.userId, plan, definitions: { used: z.number().nonnegative().parse(used ?? 0), limit: PLAN_COMMENTARY_QUOTA[plan], resetsIn } }
    },
})

import { createDefinitionHandler } from './definitions'
import { definitionServices } from './definition-services'
const definitionPOST = createDefinitionHandler({ verify, store: catalogStore, services: definitionServices })
import { createEbookHandler } from './ebooks'
import { ebookStore } from './ebook-store'
const ebookHandler = createEbookHandler({ verify, catalog: catalogStore, ebooks: ebookStore })
const isEbookRoute = (request: Request) => /\/(ebook|ebook-position|ebook-bookmarks)$/.test(new URL(request.url).pathname)
export const mobileGET = (request: Request) => isEbookRoute(request) ? ebookHandler(request) : catalogGET(request)
import { createLibraryArchiveHandler } from './library-preferences'
import { setLibraryArchived } from './library-preference-store'
const archivePOST = createLibraryArchiveHandler({ verify, catalog: catalogStore, setArchived: async (...input) => {
    await setLibraryArchived(...input)
    revalidateTag('libraries', { expire: 0 })
} })
export const mobilePOST = (request: Request) => /\/libraries\/[^/]+\/archive$/.test(new URL(request.url).pathname) ? archivePOST(request) : isEbookRoute(request) ? ebookHandler(request) : definitionPOST(request)
