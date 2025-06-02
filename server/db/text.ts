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
    const { error } = await supabase
        .from('texts')
        .insert({
            id,
            lib,
            title: title ?? 'New Text',
            content,
            topics
        })
    
    if (error) throw error
    revalidateTag(`texts:${lib}`)
    return id
}

export async function createTextWithData({ lib, title, content, topics }: { lib: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    const { data, error } = await supabase
        .from('texts')
        .insert({
            lib,
            title,
            content,
            topics
        })
        .select()
        .single()
    
    if (error) throw error
    revalidateTag(`texts:${lib}`)
    return data
}

export async function updateText({ id, title, content, topics }: { id: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    const { data: rec, error } = await supabase
        .from('texts')
        .update({ title, content, topics })
        .eq('id', id)
        .select('lib')
        .single()
    
    if (error) throw error
    if (!rec?.lib) throw new Error('Library not found')
    revalidateTag(`texts:${rec.lib}`)
    revalidateTag(`texts:${id}`)
}

export async function deleteText({ id }: { id: string }) {
    const { data: rec, error } = await supabase
        .from('texts')
        .delete()
        .eq('id', id)
        .select('lib')
        .single()
    
    if (error) throw error
    if (!rec?.lib) throw new Error('Library not found')
    revalidateTag(`texts:${rec.lib}`)
    revalidateTag(`texts:${id}`)
}

export async function getTexts({ lib }: { lib: string }) {
    'use cache'
    cacheTag(`texts:${lib}`)
    const { data: texts, error } = await supabase
        .from('texts')
        .select(`
            id,
            title,
            topics,
            ebook,
            created_at,
            updated_at,
            lib:libraries (
                name
            )
        `)
        .eq('lib', lib)
    
    if (error) throw error
    return texts.map(({ id, title, topics, ebook, created_at, updated_at, lib }) => ({
        id,
        title,
        topics,
        hasEbook: !!ebook,
        createdAt: created_at ? new Date(created_at).toISOString() : new Date().toISOString(),
        updatedAt: updated_at ? new Date(updated_at).toISOString() : new Date().toISOString(),
        libName: lib?.name ?? 'Unknown Library'
    }))
}

export async function getTextContent({ id }: { id: string }) {
    'use cache'
    cacheTag(`texts:${id}`)
    const { data: text, error } = await supabase
        .from('texts')
        .select(`
            content,
            ebook,
            title,
            topics,
            lib:libraries (
                id,
                name
            )
        `)
        .eq('id', id)
        .single()
    
    if (error) throw error
    if (!text) {
        notFound()
    }
    
    const { content, ebook, title, topics, lib } = text
    if (!lib) {
        throw new Error('lib not found')
    }
    return { content, ebook: typeof ebook === 'string' ? ebook : null, title, topics, lib: pick(lib, ['id', 'name']) }
}

export async function uploadEbook({ id, ebook }: { id: string, ebook: File }) {
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ebooks')
        .upload(`${id}/${ebook.name}`, await ebook.arrayBuffer(), {
            contentType: ebook.type
        })
    
    if (uploadError) throw uploadError
    if (!uploadData?.path) throw new Error('Failed to upload ebook')
    
    const { data: { publicUrl } } = supabase.storage
        .from('ebooks')
        .getPublicUrl(uploadData.path)
    
    const { data: text, error: updateError } = await supabase
        .from('texts')
        .update({ ebook: publicUrl })
        .eq('id', id)
        .select('lib')
        .single()
    
    if (updateError) throw updateError
    if (!text?.lib) throw new Error('Library not found')
    
    revalidateTag(`texts:${text.lib}`)
    revalidateTag(`texts:${id}`)
    return publicUrl
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
    const { data: text, error } = await supabase
        .from('texts')
        .select(`
            lib:libraries (
                id,
                lang
            )
        `)
        .eq('id', id)
        .single()
    
    if (error) throw error
    if (!text?.lib?.id || !text?.lib?.lang) throw new Error('Library not found')
    
    return { libId: text.lib.id, lang: text.lib.lang as Lang }
}
