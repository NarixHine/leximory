import 'server-only'

import { nanoid } from '@/lib/utils'
import { getXataClient } from '@/server/client/xata'
import { redis } from '../client/redis'
import { AnnotationProgress } from '@/lib/types'
import { revalidateTag } from 'next/cache'
import { Lang } from '@/lib/config'
import { unstable_cacheTag as cacheTag } from 'next/cache'
import { notFound } from 'next/navigation'
import { pick } from 'remeda'

const xata = getXataClient()

export async function createText({ lib, title, content, topics }: { lib: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    const { id } = await xata.db.texts.create({
        id: nanoid(),
        lib,
        title: title ?? 'New Text',
        content,
        topics
    })
    revalidateTag(`texts:${lib}`)
    return id
}

export async function createTextWithData({ lib, title, content, topics }: { lib: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    const text = await xata.db.texts.create({
        lib,
        title,
        content,
        topics
    })
    revalidateTag(`texts:${lib}`)
    return text
}

export async function updateText({ id, title, content, topics }: { id: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    const rec = await xata.db.texts.update(id, { title, content, topics })
    revalidateTag(`texts:${rec!.lib!.id}`)
    revalidateTag(`texts:${id}`)
}

export async function deleteText({ id }: { id: string }) {
    const rec = await xata.db.texts.delete(id)
    revalidateTag(`texts:${rec!.lib!.id}`)
    revalidateTag(`texts:${id}`)
}

export async function getTexts({ lib }: { lib: string }) {
    'use cache'
    cacheTag(`texts:${lib}`)
    const texts = await xata.db.texts.select(['title', 'topics', 'ebook.url']).filter({ lib }).getAll()
    return texts.map(({ id, title, topics, ebook, xata }) => ({
        id,
        title,
        topics,
        hasEbook: !!ebook?.url,
        createdAt: xata.createdAt.toISOString(),
        updatedAt: xata.updatedAt.toISOString()
    }))
}

export async function getTextContent({ id }: { id: string }) {
    'use cache'
    cacheTag(`texts:${id}`)
    const text = await xata.db.texts.select(['content', 'ebook', 'title', 'topics', 'lib.name']).filter({ id }).getFirst()
    if (!text) {
        notFound()
    }
    const { content, ebook, title, topics, lib } = text
    if (!lib) {
        throw new Error('lib not found')
    }
    return { content, ebook: ebook?.url, title, topics, lib: pick(lib, ['id', 'name']) }
}

export async function uploadEbook({ id, ebook }: { id: string, ebook: File }) {
    const { url } = await xata.files.upload(
        { table: 'texts', column: 'ebook', record: id },
        await ebook.arrayBuffer(),
        { mediaType: ebook.type }
    )
    const { lib } = await xata.db.texts.select(['lib.id']).filter({ id }).getFirstOrThrow()
    revalidateTag(`texts:${lib!.id}`)
    revalidateTag(`texts:${id}`)
    return url
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
    const text = await xata.db.texts.select(['lib.id', 'lib.lang']).filter({ id }).getFirstOrThrow()
    return { libId: text.lib!.id, lang: text.lib!.lang as Lang }
}
