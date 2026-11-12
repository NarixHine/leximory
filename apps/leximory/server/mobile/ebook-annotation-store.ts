import 'server-only'
import type { supabase } from '@repo/supabase'
import { z } from 'zod'
import { ebookAnnotationSchema } from '@repo/api'
import { checkedResponse } from './http'
import type { EbookAnnotationStore } from './ebook-annotations'

export function createEbookAnnotationStore(database: Pick<typeof supabase, 'from'>): EbookAnnotationStore {
    return {
        async get(id, userId, textId, signal) {
            const { data } = await database
                .from('ebook_preannotations')
                .select('*')
                .eq('id', id)
                .eq('user_id', userId)
                .eq('text_id', textId)
                .abortSignal(signal)
                .maybeSingle()
                .throwOnError()
            return data
                ? {
                      id: data.id,
                      userId: data.user_id,
                      textId: data.text_id,
                      sourceVersion: data.source_version,
                      location: data.location,
                      text: data.source_text,
                      complete: data.complete,
                      annotations: checkedResponse(z.array(ebookAnnotationSchema).max(48), data.annotations),
                  }
                : null
        },
        async create(unit, signal) {
            await database
                .from('ebook_preannotations')
                .insert({
                    id: unit.id,
                    user_id: unit.userId,
                    text_id: unit.textId,
                    source_version: unit.sourceVersion,
                    location: unit.location,
                    source_text: unit.text,
                })
                .abortSignal(signal)
                .throwOnError()
        },
        async save(unit, signal) {
            await database
                .from('ebook_preannotations')
                .update({
                    annotations: unit.annotations,
                    complete: unit.complete,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', unit.id)
                .eq('user_id', unit.userId)
                .eq('text_id', unit.textId)
                .select('id')
                .abortSignal(signal)
                .single()
                .throwOnError()
        },
    }
}
