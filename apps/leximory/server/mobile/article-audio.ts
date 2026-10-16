import { z } from 'zod'
import { resourceID } from '@repo/api'
import { maxArticleLength } from '@repo/env/content'
import { canWriteLibrary } from '@repo/service/access'
import type { Lang } from '@repo/schema/library'
import { createCatalog, type CatalogStore } from './catalog'
import { articleAudioID, articleSpeech, existingFullArticleAudioID } from './article-speech'
import { renderDocument } from './render-document'
import { MobileError } from './errors'
import { checkedResponse, jsonBody, query, type MobileOperation } from './http'

const inputSchema = z.object({ revision: z.string().regex(/^[a-f0-9]{64}$/) }).strict()
const outputSchema = z.object({ audioId: resourceID }).strict()
export interface ArticleAudioStore {
    generate(input: { id: string; text: string; lang: Lang; userId: string; signal: AbortSignal }): Promise<void>
}
export function createArticleAudioOperations(dependencies: { catalog: CatalogStore; audio: ArticleAudioStore }) {
    const catalog = createCatalog(dependencies.catalog)
    const generateArticleAudio: MobileOperation = async ({ request, subject, params, signal }) => {
        query(request, [])
        const { text, library } = await catalog.authorizedText(subject, resourceID.parse(params.textId), signal)
        if (!canWriteLibrary(subject, library) || library.shadow || text.has_ebook || text.bookmark_url)
            throw new MobileError('inaccessible')
        const input = inputSchema.parse(await jsonBody(request, 1024, signal))
        const document = renderDocument(text.content)
        if (input.revision !== document.revision) throw new MobileError('stale_revision')
        const existing = existingFullArticleAudioID(document)
        if (existing && (await dependencies.catalog.audio(existing, signal))) return { audioId: existing }
        const speech = articleSpeech(document)
        if (!speech || speech.length > maxArticleLength(library.lang)) throw new MobileError('invalid_input')
        const id = articleAudioID(text.id, speech)
        await dependencies.audio.generate({ id, text: speech, lang: library.lang, userId: subject.userId, signal })
        return checkedResponse(outputSchema, { audioId: id })
    }
    return { generateArticleAudio }
}
