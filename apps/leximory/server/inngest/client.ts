import 'server-only'
import env from '@repo/env'
import { createInngestClient } from './runtime'
import { createArticlePublisher, createEventPublisher } from './publish'

export const inngest = createInngestClient(env)
export const publishArticleImport = createArticlePublisher(inngest)
export const publishEvent = createEventPublisher(inngest)
