import 'server-only'

import { randomID } from '@/lib/utils'
import { getXataClient } from '@/lib/xata'

const xata = getXataClient()

export async function createText({ lib }: { lib: string }) {
    const { id } = await xata.db.texts.create({
        id: randomID(),
        lib,
        title: '',
    })
    return id
}

export async function updateText({ id, title, content, topics }: { id: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    await xata.db.texts.update(id, { title, content, topics })
}

export async function deleteText({ id }: { id: string }) {
    await xata.db.texts.delete(id)
}

export async function getTexts({ lib }: { lib: string }) {
    const texts = await xata.db.texts.select(['title', 'topics']).filter({ lib }).getAll()
    return texts.map(text => ({
        id: text.id,
        title: text.title,
        topics: text.topics,
    }))
}

export async function getTextContent({ id }: { id: string }) {
    const { content, ebook, title, topics, lib } = await xata.db.texts.select(['content', 'ebook', 'title', 'topics', 'lib.name']).filter({ id }).getFirstOrThrow()
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
    return url
}
