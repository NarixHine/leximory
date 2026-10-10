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
import { createBrowserHandler } from './browser'
import { browserStore } from './browser-store'
const browserHandler = createBrowserHandler({ verify, catalog: catalogStore, browser: browserStore, definitions: definitionServices })
const isBrowserRoute = (request: Request) => /\/(browser\/(selection|definitions|vocabulary|rules)|libraries\/[^/]+\/bookmarks)$/.test(new URL(request.url).pathname)
import { createEbookHandler } from './ebooks'
import { ebookStore } from './ebook-store'
const ebookHandler = createEbookHandler({ verify, catalog: catalogStore, ebooks: ebookStore })
const isEbookRoute = (request: Request) => /\/(ebook|ebook-position|ebook-bookmarks)$/.test(new URL(request.url).pathname)
import { createAuthoringHandler } from './authoring'
import { authoringStore } from './authoring-store'
const authoringHandler = createAuthoringHandler({ verify, catalog: catalogStore, authoring: authoringStore })
const isAuthoringRoute = (request: Request) => /\/(vocabulary\/[^/]+|libraries\/[^/]+\/(articles|ebooks|vocabulary|article-preview))$/.test(new URL(request.url).pathname)
export const mobileGET = (request: Request) => isBrowserRoute(request) ? browserHandler(request) : isAuthoringRoute(request) ? authoringHandler(request) : isEbookRoute(request) ? ebookHandler(request) : catalogGET(request)
import { createLibraryArchiveHandler } from './library-preferences'
import { setLibraryArchived } from './library-preference-store'
const archivePOST = createLibraryArchiveHandler({ verify, catalog: catalogStore, setArchived: async (...input) => {
    await setLibraryArchived(...input)
    revalidateTag('libraries', { expire: 0 })
} })
export const mobilePOST = (request: Request) => isBrowserRoute(request) ? browserHandler(request) : isAuthoringRoute(request) ? authoringHandler(request) : /\/libraries\/[^/]+\/archive$/.test(new URL(request.url).pathname) ? archivePOST(request) : isEbookRoute(request) ? ebookHandler(request) : definitionPOST(request)
