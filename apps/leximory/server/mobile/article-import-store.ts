import 'server-only'
import { randomUUID } from 'node:crypto'
import type { supabase } from '@repo/supabase'
import { z } from 'zod'
import type { AuthoringStore } from './authoring'
import { checkedResponse } from './http'
import { summarizeText, textRowSchema } from './catalog'
import { MobileError } from './errors'
import { mobileMutationID } from './vocabulary-save'

type ArticleImport = AuthoringStore['article']
type AnnotationEvent = {
    id: string
    data: { article: string; userId: string; textId: string; onlyComments: boolean; generateTitle: boolean }
}

export function createArticleImporter(dependencies: {
    database: Pick<typeof supabase, 'from'>
    charge(userId: string, requestId: string): Promise<void>
    accepted: { get(id: string): Promise<unknown>; set(id: string): Promise<void> }
    markPending(id: string): Promise<void>
    enqueue(event: AnnotationEvent): Promise<void>
}): ArticleImport {
    return async (subject, library, input) => {
        const { requestId } = input
        const id = requestId
            ? mobileMutationID(
                  'article-import',
                  subject.userId,
                  library.id,
                  requestId,
                  JSON.stringify([input.title, input.content, input.annotate, input.onlyComments, input.generateTitle]),
              )
            : randomUUID()
        const { data: existing } = await dependencies.database
            .from('texts')
            .select('*')
            .eq('id', id)
            .maybeSingle()
            .throwOnError()
        let text = existing ? checkedResponse(textRowSchema, existing) : null
        if (text && text.id !== id) throw new MobileError('service_unavailable')
        if (text && (text.lib !== library.id || text.has_ebook || text.bookmark_url))
            throw new MobileError('inaccessible')
        if (input.annotate) {
            const accepted = await dependencies.accepted.get(id)
            if (accepted !== null) {
                checkedResponse(z.literal(id), accepted)
                if (!text) throw new MobileError('inaccessible')
                return summarizeText(text)
            }
            await dependencies.charge(subject.userId, id)
        }
        if (!text) {
            await dependencies.database
                .from('texts')
                .upsert(
                    {
                        id,
                        lib: library.id,
                        title: input.title,
                        content: input.content,
                        has_ebook: false,
                        bookmark_url: null,
                    },
                    { onConflict: 'id', ignoreDuplicates: true },
                )
                .throwOnError()
            const { data } = await dependencies.database.from('texts').select('*').eq('id', id).single().throwOnError()
            text = checkedResponse(textRowSchema, data)
            if (text.id !== id) throw new MobileError('service_unavailable')
            if (text.lib !== library.id || text.has_ebook || text.bookmark_url) throw new MobileError('inaccessible')
        }
        if (input.annotate) {
            await dependencies.markPending(id)
            // A lost acknowledgement must replay the same job, never delete its saved source text.
            await dependencies.enqueue({
                id: 'mobile-article-' + id,
                data: {
                    article: input.content,
                    userId: subject.userId,
                    textId: id,
                    onlyComments: input.onlyComments,
                    generateTitle: input.generateTitle,
                },
            })
            await dependencies.accepted.set(id)
        }
        return summarizeText(text)
    }
}
