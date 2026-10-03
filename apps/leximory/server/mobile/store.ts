import 'server-only'
import { supabase } from '@repo/supabase'
import { z } from 'zod'
import { libraryRowSchema, textRowSchema, PAGE_SIZE, type CatalogStore, type TextCursor } from './catalog'

// Equal sort keys continue by ID; null manual positions precede numbered texts.
export function textContinuation(cursor: TextCursor): string {
    const dateAfter = cursor.createdAt === null
        ? `and(created_at.is.null,id.gt.${cursor.id})`
        : `created_at.lt.${cursor.createdAt},created_at.is.null,and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`
    const sameNo = cursor.no === null ? 'no.is.null' : `no.eq.${cursor.no}`
    return [
        cursor.no === null ? 'no.not.is.null' : `no.gt.${cursor.no}`,
        `and(${sameNo},or(${dateAfter}))`,
    ].join(',')
}
export const catalogStore: CatalogStore = {
    async library(id, signal) {
        const { data } = await supabase.from('libraries').select('id,name,lang,owner,access,starred_by,shadow').eq('id', id).abortSignal(signal).maybeSingle().throwOnError()
        return data ? libraryRowSchema.parse(data) : null
    },
    async text(id, signal) {
        const { data } = await supabase.from('texts').select('*').eq('id', id).abortSignal(signal).maybeSingle().throwOnError()
        return data ? textRowSchema.parse(data) : null
    },
    async libraries(subject, after, signal) {
        // Auth provider IDs are interpolated only after UUID validation.
        const userId = z.uuid().parse(subject.userId)
        let query = supabase.from('libraries').select('id,name,lang,owner,access,starred_by,shadow')
            .or(`owner.eq.${userId},and(access.eq.1,starred_by.cs.{${userId}})`)
            .order('id').limit(PAGE_SIZE + 1).abortSignal(signal)
        if (after) query = query.gt('id', after)
        const { data } = await query.throwOnError()
        return z.array(libraryRowSchema).parse(data)
    },
    async texts(libraryId, after, signal) {
        let query = supabase.from('texts').select('*').eq('lib', libraryId)
            .order('no', { ascending: true, nullsFirst: true })
            .order('created_at', { ascending: false, nullsFirst: false }).order('id')
            .limit(PAGE_SIZE + 1).abortSignal(signal)
        if (after) query = query.or(textContinuation(after))
        const { data } = await query.throwOnError()
        return z.array(textRowSchema).parse(data)
    },
    async archived(subject, signal) {
        const { data } = await supabase.from('users').select('archived_libs').eq('id', subject.userId).abortSignal(signal).maybeSingle().throwOnError()
        return z.array(z.string()).nullable().parse(data?.archived_libs ?? null) ?? []
    },
    async audio(id, signal) {
        signal.throwIfAborted()
        const { data, error } = await supabase.storage.from('user-files').createSignedUrl(`audio/${id}.mp3`, 3600)
        signal.throwIfAborted()
        if (error) return null
        return data?.signedUrl ?? null
    },
}
