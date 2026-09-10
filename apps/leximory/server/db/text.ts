import 'server-only'
import { nanoid } from '@/lib/utils'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import { AnnotationProgress } from '@/lib/types'
import { Lang, LIB_ACCESS_STATUS } from '@repo/env/config'
import { cacheTag } from 'next/cache'
import { notFound } from 'next/navigation'
import { pick } from 'es-toolkit'
import { seconds } from 'itty-time'

/** Fetches a text record with its parent library attached for authorization checks. */
export async function getTextWithLib(textId: string) {
    const { data, error } = await supabase
        .from('texts')
        .select(
            `
            *,
            lib:libraries!inner (
                id,
                owner,
                access,
                starred_by
            )
        `,
        )
        .eq('id', textId)
        .single()
    if (error || !data) throw new Error('Text not found')
    return data as typeof data & {
        lib: { id: string; owner: string; access: number; starred_by: string[] | null }
    }
}

export async function createText({
    lib,
    title,
    content,
    topics,
}: { lib: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    const id = nanoid()
    await supabase
        .from('texts')
        .insert({
            id,
            lib,
            title: title ?? 'New Text',
            content,
            topics,
        })
        .throwOnError()
    return id
}

export async function createTextWithData({
    lib,
    title,
    content,
    topics,
}: { lib: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    const { data } = await supabase
        .from('texts')
        .insert({
            lib,
            title,
            content,
            topics,
        })
        .select()
        .single()
        .throwOnError()
    return data
}

export async function updateText({
    id,
    title,
    content,
    topics,
    emoji,
}: { id: string } & Partial<{
    content: string
    topics: string[]
    title: string
    emoji: string | null
}>) {
    const { data: rec } = await supabase
        .from('texts')
        .update({ title, content, topics, emoji })
        .eq('id', id)
        .select('lib')
        .single()
        .throwOnError()
    return rec.lib!
}

export async function deleteText({ id }: { id: string }) {
    const { data: rec } = await supabase
        .from('texts')
        .delete()
        .eq('id', id)
        .select('lib, has_ebook')
        .single()
        .throwOnError()
    if (rec.has_ebook) {
        await supabase.storage
            .from('user-files')
            .remove([`ebooks/${id}.epub`, `ebooks/${id}.pdf`])
    }
}

export async function getTexts({ lib }: { lib: string }) {
    'use cache'
    cacheTag(`texts:${lib}`)
    const { data: texts } = await supabase
        .from('texts')
        .select(
            `
            id,
            title,
            topics,
            emoji,
            has_ebook,
            created_at,
            no,
            lib:libraries (
                name, id
            )
        `,
        )
        .eq('lib', lib)
        .order('no', { nullsFirst: true }) // prioritize manual sorting; newly created texts first
        .order('created_at', { ascending: false })
        .throwOnError()

    return texts.map(({ id, title, topics, emoji, has_ebook, created_at, lib }) => ({
        id,
        title,
        topics,
        emoji,
        hasEbook: has_ebook,
        createdAt: created_at ? new Date(created_at).toISOString() : new Date().toISOString(),
        libName: lib?.name ?? 'Unknown Library',
    }))
}

async function getTextContentFromDb({ id }: { id: string }) {
    const { data: text, error } = await supabase
        .from('texts')
        .select(
            `
            content,
            has_ebook,
            title,
            topics,
            emoji,
            created_at,
            lib:libraries (
                id,
                name,
                lang,
                prompt,
                price,
                access
            )
        `,
        )
        .eq('id', id)
        .limit(1)

    if (error) throw error

    if (!text || text.length === 0) {
        notFound()
    }

    const { content, has_ebook, title, topics, emoji, created_at, lib } = text[0]
    const isPublicAndFree = lib?.access === LIB_ACCESS_STATUS.public && lib?.price === 0
    const prompt = lib?.prompt ?? ''
    if (!lib) {
        throw new Error('lib not found')
    }
    if (has_ebook) {
        let data: { signedUrl: string } | null = null
        let error: Error | null = null
        for (const extension of ['pdf', 'epub']) {
            const result = await supabase.storage
                .from('user-files')
                .createSignedUrl(`ebooks/${id}.${extension}`, seconds('3 days'))
            if (!result.error) {
                data = result.data
                break
            }
            error = result.error
        }
        if (!data) throw error
        return {
            content,
            ebook: data.signedUrl,
            title,
            topics,
            emoji,
            createdAt: created_at,
            lib: pick(lib, ['id', 'name', 'lang']) as { id: string; name: string; lang: Lang },
            prompt,
            isPublicAndFree,
        }
    }
    return {
        content,
        ebook: null,
        title,
        topics,
        emoji,
        createdAt: created_at,
        lib: pick(lib, ['id', 'name', 'lang']) as { id: string; name: string; lang: Lang },
        prompt,
        isPublicAndFree,
    }
}

export async function getTextContent({ id }: { id: string }) {
    'use cache'
    const result = await getTextContentFromDb({ id })
    cacheTag(`texts:${result.lib.id}`)
    return result
}

export async function getFreshTextContent({ id }: { id: string }) {
    return getTextContentFromDb({ id })
}

export async function uploadEbook({ id, ebook }: { id: string; ebook: File }) {
    const extension = ebook.type === 'application/pdf' || ebook.name.toLowerCase().endsWith('.pdf')
        ? 'pdf'
        : 'epub'
    await supabase.storage
        .from('user-files')
        .remove([`ebooks/${id}.epub`, `ebooks/${id}.pdf`])
    const { data: uploadData } = await supabase.storage
        .from('user-files')
        .upload(`ebooks/${id}.${extension}`, await ebook.arrayBuffer(), {
            contentType: ebook.type,
            upsert: true,
        })

    if (!uploadData?.path) throw new Error('Failed to upload ebook')
    const { path } = uploadData

    const { data: text, error: updateError } = await supabase
        .from('texts')
        .update({ has_ebook: true })
        .eq('id', id)
        .select('lib')
        .single()

    if (updateError) throw updateError
    if (!text?.lib) throw new Error('Library not found')

    const { data } = await supabase.storage
        .from('user-files')
        .createSignedUrl(path, seconds('3 days'))

    return data!.signedUrl
}

export async function getTextAnnotationProgress({ id }: { id: string }) {
    const annotationProgress = await redis.get(`text:${id}:annotation`)
    return annotationProgress ? (annotationProgress as AnnotationProgress) : null
}

export async function setTextAnnotationProgress({
    id,
    progress,
}: {
    id: string
    progress: AnnotationProgress
}) {
    await redis.set(`text:${id}:annotation`, progress, {
        ex: seconds('3 minutes'),
    })
}

export async function getLibIdAndLangOfText({ id }: { id: string }) {
    'use cache'
    const { data: text } = await supabase
        .from('texts')
        .select(
            `
            lib:libraries (
                id,
                lang
            )
        `,
        )
        .eq('id', id)
        .single()
        .throwOnError()

    cacheTag(`texts:${text.lib!.id}`)
    return { libId: text.lib!.id, lang: text.lib!.lang as Lang }
}
