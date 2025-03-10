import 'server-only'

import { randomID } from '@/lib/utils'
import { getXataClient } from '@/server/client/xata'
import { redis } from '../client/redis'
import { AnnotationProgress } from '@/lib/types'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { Lang } from '@/lib/config'

const xata = getXataClient()

export async function createText({ lib }: { lib: string }) {
    const { id } = await xata.db.texts.create({
        id: randomID(),
        lib,
        title: '',
    })
    revalidatePath(`/library/${lib}`)
    return id
}

export async function createTextWithData({ lib, title, content, topics }: { lib: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    const text = await xata.db.texts.create({
        lib,
        title,
        content,
        topics
    })
    return text
}

export async function updateText({ id, title, content, topics }: { id: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    const rec = await xata.db.texts.update(id, { title, content, topics })
    revalidatePath(`/library/${rec!.lib!.id}`)
}

export async function deleteText({ id }: { id: string }) {
    const rec = await xata.db.texts.delete(id)
    revalidatePath(`/library/${rec!.lib!.id}`)
}

export async function getTexts({ lib }: { lib: string }) {
    const texts = await xata.db.texts.select(['title', 'topics', 'ebook.url']).filter({ lib }).getAll()
    return texts
}

export async function getTextContent({ id }: { id: string }) {
    const text = await xata.db.texts.select(['content', 'ebook', 'title', 'topics', 'lib.name']).filter({ id }).getFirst()
    if (!text) {
        notFound()
    }
    const { content, ebook, title, topics, lib } = text
    if (!lib) {
        throw new Error('lib not found')
    }
    return { content, ebook, title, topics, lib }
}

export async function uploadEbook({ id, ebook }: { id: string, ebook: File }) {
    const { url } = await xata.files.upload(
        { table: 'texts', column: 'ebook', record: id },
        await ebook.arrayBuffer(),
        { mediaType: ebook.type }
    )
    const { lib } = await xata.db.texts.select(['lib.id']).filter({ id }).getFirstOrThrow()
    revalidatePath(`/library/${lib!.id}/${id}`)
    return url
}

export async function getTextAnnotationProgress({ id }: { id: string }) {
    const annotationProgress = await redis.get(`text:${id}:annotation`)
    return annotationProgress ? (annotationProgress as AnnotationProgress) : null
}

export async function setTextAnnotationProgress({ id, progress }: { id: string, progress: AnnotationProgress }) {
    await redis.set(`text:${id}:annotation`, progress)
}

export async function getLibIdAndLangOfText({ id }: { id: string }) {
    const text = await xata.db.texts.select(['lib.id', 'lib.lang']).filter({ id }).getFirstOrThrow()
    return { libId: text.lib!.id, lang: text.lib!.lang as Lang }
}
