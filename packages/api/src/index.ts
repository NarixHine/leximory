import { oc } from '@orpc/contract'
import { z } from 'zod'
import { LangSchema } from '@repo/schema/library'
import { renderDocumentSchema, mobileErrorSchema, occurrenceSchema } from '@repo/schema/mobile'

export const resourceID = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
export const pageInput = z.object({ cursor: z.string().max(1024).optional() }).strict()
export const librarySchema = z.object({
    id: resourceID, name: z.string(), language: LangSchema,
    owned: z.boolean(), archived: z.boolean(), shadow: z.boolean(),
}).strict()
export const textSchema = z.object({
    id: resourceID, libraryId: resourceID, title: z.string(), topics: z.array(z.string()),
    emoji: z.string().nullable(), createdAt: z.string().nullable(),
    format: z.enum(['article', 'ebook']),
}).strict()
export const accountSchema = z.object({
    userId: z.string(), plan: z.enum(['beginner', 'bilingual', 'polyglot', 'leximory']),
    definitions: z.object({ used: z.number().nonnegative(), limit: z.number().nonnegative(), resetsIn: z.int() }).strict(),
}).strict()
export const librariesSchema = z.object({ items: z.array(librarySchema), nextCursor: z.string().nullable() }).strict()
export const textsSchema = z.object({ items: z.array(textSchema), nextCursor: z.string().nullable() }).strict()
export const documentSchema = z.object({ text: textSchema, library: librarySchema, document: renderDocumentSchema.nullable(), annotationProgress: z.string().nullable().optional() }).strict()
export const audioSchema = z.object({ url: z.url(), expiresAt: z.iso.datetime() }).strict()
export const ebookBookmarkSchema = z.object({
    id: z.number(), quote: z.string(), chapter: z.string().nullable(), location: z.string().nullable(), createdAt: z.string().nullable(),
}).strict()
export const ebookSchema = z.object({
    text: textSchema, library: librarySchema, url: z.url(), format: z.enum(['pdf', 'epub']),
    expiresAt: z.iso.datetime(), location: z.string().nullable(), bookmarks: z.array(ebookBookmarkSchema),
}).strict()
export const ebookSelectionSchema = z.object({ quote: z.string().min(1).max(1024), context: z.string().min(1).max(4000), offset: z.int().min(0).max(4000) }).strict()
export const definitionSchema = z.object({
    lemma: z.string().min(1).max(1024), definition: z.string().min(1).max(16000),
    etymology: z.string().max(16000).nullable(), cognates: z.string().max(16000).nullable(),
}).strict()

export const definitionFrameSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('started'), requestId: resourceID }).strict(),
    z.object({ kind: z.literal('delta'), requestId: resourceID, text: z.string() }).strict(),
    z.object({ kind: z.literal('completed'), requestId: resourceID, definition: definitionSchema }).strict(),
    z.object({ kind: z.literal('failed'), requestId: resourceID, error: mobileErrorSchema.shape.error }).strict(),
])
export const vocabularyInputSchema = z.object({ occurrence: occurrenceSchema, completionId: resourceID.nullable().optional() }).strict()
export const vocabularyEditSchema = definitionSchema.extend({
    original: z.string().min(1).max(1024),
}).strict()
export const savedWordSchema = z.object({ id: resourceID, libraryId: resourceID, fields: vocabularyEditSchema, createdAt: z.string().nullable().optional(), protected: z.boolean().optional() }).strict()
export const articleImportSchema = z.object({
    title: z.string().trim().min(1).max(512), content: z.string().min(1).max(30000),
    annotate: z.boolean(), onlyComments: z.boolean(), generateTitle: z.boolean(),
}).strict()
export const extractedArticleSchema = z.object({ title: z.string().min(1).max(512), content: z.string().min(1).max(30000) }).strict()
export const mobileContract = {
    extractArticle: oc.route({ method: 'POST', path: '/libraries/{libraryId}/article-preview' }).input(z.object({ libraryId: resourceID, url: z.url().max(2048) })).output(extractedArticleSchema),
    vocabularyList: oc.route({ method: 'GET', path: '/libraries/{libraryId}/vocabulary' }).input(pageInput.extend({ libraryId: resourceID })).output(z.object({ items: z.array(savedWordSchema), nextCursor: z.string().nullable() })),
    savedWord: oc.route({ method: 'GET', path: '/vocabulary/{wordId}' }).input(z.object({ wordId: resourceID })).output(savedWordSchema),
    editWord: oc.route({ method: 'POST', path: '/vocabulary/{wordId}' }).input(vocabularyEditSchema.extend({ wordId: resourceID })).output(savedWordSchema),
    importArticle: oc.route({ method: 'POST', path: '/libraries/{libraryId}/articles' }).input(articleImportSchema.extend({ libraryId: resourceID })).output(textSchema),
    definitions: oc.route({ method: 'POST', path: '/texts/{textId}/definitions', spec: spec => ({
        ...spec, responses: { ...spec.responses, 200: { description: 'NDJSON frames; one terminal completed or failed record', content: { 'application/x-ndjson': { schema: { type: 'string', format: 'binary' } } } } },
    }) }).input(occurrenceSchema).output(z.string()),
    vocabulary: oc.route({ method: 'POST', path: '/texts/{textId}/vocabulary' }).input(vocabularyInputSchema.extend({ textId: resourceID })).output(z.object({ id: resourceID, libraryId: resourceID }).strict()),
    ebook: oc.route({ method: 'GET', path: '/texts/{textId}/ebook' }).input(z.object({ textId: resourceID })).output(ebookSchema),
    ebookPosition: oc.route({ method: 'POST', path: '/texts/{textId}/ebook-position' }).input(z.object({ textId: resourceID, location: z.string().min(1).max(2048) })).output(z.object({ saved: z.boolean() })),
    ebookBookmark: oc.route({ method: 'POST', path: '/texts/{textId}/ebook-bookmarks' }).input(z.object({ textId: resourceID, quote: z.string().min(1).max(16000), chapter: z.string().max(512).nullable(), location: z.string().max(2048).nullable() })).output(ebookBookmarkSchema),
    ebookDefinitions: oc.route({ method: 'POST', path: '/texts/{textId}/ebook-definitions', spec: spec => ({
        ...spec, responses: { ...spec.responses, 200: { description: 'Contextual ebook definition frames', content: { 'application/x-ndjson': { schema: { type: 'string', format: 'binary' } } } } },
    }) }).input(ebookSelectionSchema.extend({ textId: resourceID })).output(z.string()),
    ebookVocabulary: oc.route({ method: 'POST', path: '/texts/{textId}/ebook-vocabulary' }).input(z.object({ textId: resourceID, completionId: resourceID })).output(z.object({ id: resourceID, libraryId: resourceID }).strict()),
    me: oc.route({ method: 'GET', path: '/me' }).output(accountSchema),
    libraryArchive: oc.route({ method: 'POST', path: '/libraries/{libraryId}/archive' }).input(z.object({ libraryId: resourceID, archived: z.boolean() })).output(z.object({ archived: z.boolean() })),
    libraries: oc.route({ method: 'GET', path: '/libraries' }).input(pageInput).output(librariesSchema),
    texts: oc.route({ method: 'GET', path: '/libraries/{libraryId}/texts' }).input(pageInput.extend({ libraryId: resourceID })).output(textsSchema),
    document: oc.route({ method: 'GET', path: '/texts/{textId}' }).input(z.object({ textId: resourceID })).output(documentSchema),
    audio: oc.route({ method: 'GET', path: '/texts/{textId}/audio/{audioId}' }).input(z.object({ textId: resourceID, audioId: resourceID })).output(audioSchema),
}
export { mobileErrorSchema }
export type MobileLibrary = z.infer<typeof librarySchema>
export type MobileText = z.infer<typeof textSchema>
