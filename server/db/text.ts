import 'server-only'
import { nanoid } from '@/lib/utils'
import { supabase } from '@/server/client/supabase'
import { redis } from '../client/redis'
import { AnnotationProgress } from '@/lib/types'
import { revalidateTag } from 'next/cache'
import { Lang } from '@/lib/config'
import { unstable_cacheTag as cacheTag } from 'next/cache'
import { notFound } from 'next/navigation'
import { pick } from 'es-toolkit'

export async function createText({ lib, title, content, topics }: { lib: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    const id = nanoid()
    await supabase
        .from('texts')
        .insert({
            id,
            lib,
            title: title ?? 'New Text',
            content,
            topics
        })
        .throwOnError()
    revalidateTag(`texts:${lib}`)
    return id
}

export async function createTextWithData({ lib, title, content, topics }: { lib: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    const { data } = await supabase
        .from('texts')
        .insert({
            lib,
            title,
            content,
            topics
        })
        .select()
        .single()
        .throwOnError()
    revalidateTag(`texts:${lib}`)
    return data
}

export async function updateText({ id, title, content, topics }: { id: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    const { data: rec } = await supabase
        .from('texts')
        .update({ title, content, topics })
        .eq('id', id)
        .select('lib')
        .single()
        .throwOnError()
    revalidateTag(`texts:${rec.lib}`)
    revalidateTag(`texts:${id}`)
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
            .remove([`ebooks/${id}.epub`])
    }

    revalidateTag(`texts:${rec.lib}`)
    revalidateTag(`texts:${id}`)
}

export async function getTexts({ lib }: { lib: string }) {
    'use cache'
    cacheTag(`texts:${lib}`)
    const { data: texts } = await supabase
        .from('texts')
        .select(`
            id,
            title,
            topics,
            has_ebook,
            created_at,
            lib:libraries (
                name
            )
        `)
        .eq('lib', lib)
        .throwOnError()

    return texts.map(({ id, title, topics, has_ebook, created_at, lib }) => ({
        id,
        title,
        topics,
        hasEbook: has_ebook,
        createdAt: created_at ? new Date(created_at).toISOString() : new Date().toISOString(),
        libName: lib?.name ?? 'Unknown Library'
    }))
}

export async function getTextContent({ id }: { id: string }) {
    'use cache'
    cacheTag(`texts:${id}`)
    const { data: text } = await supabase
        .from('texts')
        .select(`
            content,
            has_ebook,
            title,
            topics,
            lib:libraries (
                id,
                name
            )
        `)
        .eq('id', id)
        .single()
        .throwOnError()

    if (!text) {
        notFound()
    }

    const { content, has_ebook, title, topics, lib } = text
    if (!lib) {
        throw new Error('lib not found')
    }
    if (has_ebook) {
        const { data, error } = await supabase.storage
            .from('user-files')
            .createSignedUrl(`ebooks/${id}.epub`, 60 * 60 * 24 * 30)
        if (error) throw error
        return { content, ebook: data.signedUrl, title, topics, lib: pick(lib, ['id', 'name']) }
    }
    return { content, ebook: null, title, topics, lib: pick(lib, ['id', 'name']) }
}

export async function uploadEbook({ id, ebook }: { id: string, ebook: File }) {
    const { data: uploadData } = await supabase.storage
        .from('user-files')
        .upload(`ebooks/${id}.epub`, await ebook.arrayBuffer(), {
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

    revalidateTag(`texts:${text.lib}`)
    revalidateTag(`texts:${id}`)
    return path
}

export async function getTextAnnotationProgress({ id }: { id: string }) {
    const annotationProgress = await redis.get(`text:${id}:annotation`)
    return annotationProgress ? (annotationProgress as AnnotationProgress) : null
}

export async function setTextAnnotationProgress({ id, progress }: { id: string, progress: AnnotationProgress }) {
    await redis.set(`text:${id}:annotation`, progress, {
        ex: 60 * 5,
    })
}

export async function getLibIdAndLangOfText({ id }: { id: string }) {
    'use cache'
    cacheTag(`texts:${id}`)
    const { data: text } = await supabase
        .from('texts')
        .select(`
            lib:libraries (
                id,
                lang
            )
        `)
        .eq('id', id)
        .single()
        .throwOnError()

    return { libId: text.lib!.id, lang: text.lib!.lang as Lang }
}
