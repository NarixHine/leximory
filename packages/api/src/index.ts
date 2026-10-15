import { oc } from '@orpc/contract'
import { z } from 'zod'
import { LangSchema } from '@repo/schema/library'
import { renderDocumentSchema, mobileErrorSchema, occurrenceSchema } from '@repo/schema/mobile'

export const resourceID = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
export const pageInput = z.object({ cursor: z.string().max(1024).optional() }).strict()
export const librarySchema = z
    .object({
        id: resourceID,
        name: z.string(),
        language: LangSchema,
        owned: z.boolean(),
        archived: z.boolean(),
        shadow: z.boolean(),
    })
    .strict()
export const textSchema = z
    .object({
        id: resourceID,
        libraryId: resourceID,
        title: z.string(),
        topics: z.array(z.string()),
        emoji: z.string().nullable(),
        createdAt: z.string().nullable(),
        format: z.enum(['article', 'ebook', 'bookmark']),
        bookmarkURL: z.url().nullable().optional(),
    })
    .strict()
export const accountSchema = z
    .object({
        userId: z.string(),
        plan: z.enum(['beginner', 'bilingual', 'polyglot', 'leximory']),
        definitions: z
            .object({ used: z.number().nonnegative(), limit: z.number().nonnegative(), resetsIn: z.int() })
            .strict(),
    })
    .strict()
export const librariesSchema = z.object({ items: z.array(librarySchema), nextCursor: z.string().nullable() }).strict()
export const textsSchema = z.object({ items: z.array(textSchema), nextCursor: z.string().nullable() }).strict()
export const documentSchema = z
    .object({
        text: textSchema,
        library: librarySchema,
        document: renderDocumentSchema.nullable(),
        annotationProgress: z.string().nullable().optional(),
    })
    .strict()
export const audioSchema = z.object({ url: z.url(), expiresAt: z.iso.datetime() }).strict()
export const ebookBookmarkSchema = z
    .object({
        id: z.number(),
        quote: z.string(),
        chapter: z.string().nullable(),
        location: z.string().nullable(),
        createdAt: z.string().nullable(),
    })
    .strict()
export const ebookSchema = z
    .object({
        text: textSchema,
        library: librarySchema,
        url: z.url(),
        format: z.enum(['pdf', 'epub']),
        expiresAt: z.iso.datetime(),
        location: z.string().nullable(),
        bookmarks: z.array(ebookBookmarkSchema),
    })
    .strict()
export const ebookSelectionSchema = z
    .object({
        quote: z.string().min(1).max(1024),
        context: z.string().min(1).max(4000),
        offset: z.int().min(0).max(4000),
    })
    .strict()
export const definitionSchema = z
    .object({
        lemma: z.string().min(1).max(1024),
        definition: z.string().min(1).max(16000),
        etymology: z.string().max(16000).nullable(),
        cognates: z.string().max(16000).nullable(),
    })
    .strict()

export const definitionFrameSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('started'), requestId: resourceID }).strict(),
    z.object({ kind: z.literal('delta'), requestId: resourceID, text: z.string() }).strict(),
    z.object({ kind: z.literal('completed'), requestId: resourceID, definition: definitionSchema }).strict(),
    z.object({ kind: z.literal('failed'), requestId: resourceID, error: mobileErrorSchema.shape.error }).strict(),
])
export const vocabularyInputSchema = z
    .object({
        occurrence: occurrenceSchema,
        completionId: resourceID.nullable().optional(),
        requestId: resourceID,
    })
    .strict()
export const vocabularyEditSchema = definitionSchema
    .extend({
        original: z.string().min(1).max(1024),
    })
    .strict()
export const savedWordSchema = z
    .object({
        id: resourceID,
        libraryId: resourceID,
        fields: vocabularyEditSchema,
        createdAt: z.string().nullable().optional(),
        protected: z.boolean().optional(),
    })
    .strict()
export const articleImportSchema = z
    .object({
        title: z.string().trim().min(1).max(512),
        content: z.string().min(1).max(30000),
        annotate: z.boolean(),
        onlyComments: z.boolean(),
        generateTitle: z.boolean(),
    })
    .strict()
export const extractedArticleSchema = z
    .object({ title: z.string().min(1).max(512), content: z.string().min(1).max(30000) })
    .strict()
export const browserSelectionSchema = ebookSelectionSchema
    .extend({
        url: z.url().max(8192),
        bookmarkId: resourceID.nullish(),
        libraryId: resourceID.nullish(),
    })
    .strict()
export const browserTargetSchema = z
    .object({
        selectionId: resourceID,
        language: LangSchema,
        libraryId: resourceID.nullable(),
        libraryName: z.string(),
        shadow: z.boolean(),
    })
    .strict()
export const shortcutWordSchema = z.object({ word: z.string().trim().min(1).max(1024), requestId: resourceID }).strict()
export const shortcutWordResultSchema = z
    .object({ id: resourceID, libraryId: resourceID, language: LangSchema, libraryName: z.string() })
    .strict()
export const domainRuleSchema = z.object({ domain: z.string().min(1).max(253), libraryId: resourceID }).strict()
export const bookmarkInputSchema = z
    .object({ url: z.url().max(8192), requestId: resourceID, title: z.string().trim().min(1).max(512).optional() })
    .strict()
export const folderCreateSchema = z
    .object({ name: z.string().trim().min(1).max(128), language: LangSchema, requestId: resourceID })
    .strict()
export const folderRenameSchema = z.object({ name: z.string().trim().min(1).max(128) }).strict()
export const accountSettingsSchema = accountSchema
    .extend({
        username: z.string().nullable(),
        image: z.string().nullable(),
        email: z.string().nullable(),
        createdAt: z.string(),
        planLabel: z.string(),
        balance: z.number(),
        dailyAmount: z.number(),
        hasClaimed: z.boolean(),
        accent: z.enum(['BrE', 'AmE']),
        audio: accountSchema.shape.definitions,
        activity: z.array(z.object({ date: z.string(), count: z.int().nonnegative() }).strict()),
        today: z.string(),
        subscriptionPlans: z.array(
            z
                .object({
                    id: z.enum(['beginner', 'bilingual', 'polyglot']),
                    name: z.string(),
                    price: z.string(),
                    definitions: z.number(),
                    audio: z.number(),
                    dailyAmount: z.number(),
                })
                .strict(),
        ),
    })
    .strict()
export const avatarInputSchema = z
    .object({ data: z.string().max(1398104), contentType: z.literal('image/jpeg') })
    .strict()
export const reviewSelectionSchema = z.object({ date: z.iso.date(), lang: LangSchema })
export const reviewStartSchema = reviewSelectionSchema.strict()
export const reviewTranslationSchema = reviewSelectionSchema
    .extend({ index: z.int().min(0), submission: z.string().trim().min(1).max(500) })
    .strict()
export const reviewConversationSchema = reviewSelectionSchema
    .extend({ submission: z.string().trim().min(1).max(1200) })
    .strict()
const reviewStatus = z.enum(['idle', 'pending', 'complete', 'failed'])
const reviewFeedback = z.object({
    rationale: z.string().nullish(),
    badPairs: z.array(z.object({ original: z.string(), improved: z.string() })),
    goodPairs: z.array(z.object({ original: z.string(), note: z.string() })).nullish(),
})
const reviewTranslation = z.object({
    prompt: z.string(),
    answer: z.string(),
    keyword: z.string(),
    submission: z.string().nullish(),
    status: reviewStatus.nullish(),
    feedback: reviewFeedback.nullish(),
})
const reviewConversation = z.object({
    prompt: z.string(),
    keywords: z.array(z.string()),
    submission: z.string().nullish(),
    status: reviewStatus.nullish(),
    feedback: reviewFeedback.nullish(),
    reply: z.string().nullish(),
})
export const reviewSnapshotSchema = z.object({
    exists: z.boolean(),
    inProgress: z.boolean(),
    story: z.string().nullish(),
    translations: z.array(reviewTranslation).nullish(),
    conversation: reviewConversation.nullish(),
    storyDocument: renderDocumentSchema.nullish(),
})
export const reviewTimelineSchema = z.object({
    days: z.array(
        z.object({
            date: z.string(),
            displayDate: z.string(),
            dayOfWeek: z.string(),
            isToday: z.boolean(),
            count: z.int().nonnegative(),
            words: z.array(
                z.object({
                    id: resourceID,
                    word: z.string(),
                    lang: LangSchema,
                    lib: resourceID,
                    fields: vocabularyEditSchema.nullable(),
                }),
            ),
            progressByLang: z.record(
                z.string(),
                z.object({ percentage: z.number(), conversationCompleted: z.boolean() }),
            ),
        }),
    ),
    nextCursor: z.string().nullable(),
})
export const mobileContract = {
    reviewTimeline: oc
        .route({ method: 'GET', path: '/review' })
        .input(z.object({ cursor: z.string().max(100).optional() }).strict())
        .output(reviewTimelineSchema),
    reviewCheck: oc
        .route({ method: 'GET', path: '/review/check' })
        .input(reviewSelectionSchema.strict())
        .output(reviewSnapshotSchema),
    reviewStart: oc
        .route({ method: 'POST', path: '/review/start' })
        .input(reviewStartSchema)
        .output(z.object({ success: z.boolean() })),
    reviewTranslation: oc
        .route({ method: 'POST', path: '/review/translation' })
        .input(reviewTranslationSchema)
        .output(z.object({ success: z.boolean() })),
    reviewConversation: oc
        .route({ method: 'POST', path: '/review/conversation' })
        .input(reviewConversationSchema)
        .output(z.object({ success: z.boolean() })),
    accountSettings: oc.route({ method: 'GET', path: '/account' }).output(accountSettingsSchema),
    accountAccent: oc
        .route({ method: 'POST', path: '/account/accent' })
        .input(z.object({ accent: z.enum(['BrE', 'AmE']) }).strict())
        .output(z.object({ saved: z.boolean() })),
    accountClaim: oc.route({ method: 'POST', path: '/account/claim' }).output(z.object({ message: z.string() })),
    accountToken: oc.route({ method: 'POST', path: '/account/token' }).output(z.object({ token: z.string() })),
    accountRevokeToken: oc
        .route({ method: 'POST', path: '/account/revoke-token' })
        .output(z.object({ saved: z.boolean() })),
    accountAvatar: oc
        .route({ method: 'POST', path: '/account/avatar' })
        .input(avatarInputSchema)
        .output(z.object({ url: z.url() })),
    accountCheckout: oc
        .route({ method: 'POST', path: '/account/checkout' })
        .input(z.object({ plan: z.enum(['bilingual', 'polyglot']) }).strict())
        .output(z.object({ url: z.url() })),
    accountBilling: oc.route({ method: 'POST', path: '/account/billing' }).output(z.object({ url: z.url() })),

    createBookmark: oc
        .route({ method: 'POST', path: '/libraries/{libraryId}/bookmarks' })
        .input(bookmarkInputSchema.extend({ libraryId: resourceID }))
        .output(textSchema),
    browserSelection: oc
        .route({ method: 'POST', path: '/browser/selection' })
        .input(browserSelectionSchema)
        .output(browserTargetSchema),
    saveShortcutWord: oc
        .route({ method: 'POST', path: '/shortcuts/words' })
        .input(shortcutWordSchema)
        .output(shortcutWordResultSchema),
    browserDefinitions: oc
        .route({
            method: 'POST',
            path: '/browser/definitions',
            spec: (spec) => ({
                ...spec,
                responses: {
                    ...spec.responses,
                    200: {
                        description: 'Contextual browser definition frames',
                        content: { 'application/x-ndjson': { schema: { type: 'string', format: 'binary' } } },
                    },
                },
            }),
        })
        .input(z.object({ selectionId: resourceID }))
        .output(z.string()),
    browserVocabulary: oc
        .route({ method: 'POST', path: '/browser/vocabulary' })
        .input(z.object({ completionId: resourceID, requestId: resourceID }))
        .output(z.object({ id: resourceID, libraryId: resourceID }).strict()),
    browserRules: oc
        .route({ method: 'GET', path: '/browser/rules' })
        .output(z.object({ items: z.array(domainRuleSchema) }).strict()),
    browserRule: oc
        .route({ method: 'POST', path: '/browser/rules' })
        .input(z.object({ domain: z.string().min(1).max(253), libraryId: resourceID.nullish() }))
        .output(z.object({ saved: z.boolean() })),
    extractArticle: oc
        .route({ method: 'POST', path: '/libraries/{libraryId}/article-preview' })
        .input(z.object({ libraryId: resourceID, url: z.url().max(2048) }))
        .output(extractedArticleSchema),
    vocabularyList: oc
        .route({ method: 'GET', path: '/libraries/{libraryId}/vocabulary' })
        .input(pageInput.extend({ libraryId: resourceID }))
        .output(z.object({ items: z.array(savedWordSchema), nextCursor: z.string().nullable() })),
    savedWord: oc
        .route({ method: 'GET', path: '/vocabulary/{wordId}' })
        .input(z.object({ wordId: resourceID }))
        .output(savedWordSchema),
    editWord: oc
        .route({ method: 'POST', path: '/vocabulary/{wordId}' })
        .input(vocabularyEditSchema.extend({ wordId: resourceID }))
        .output(savedWordSchema),
    importArticle: oc
        .route({ method: 'POST', path: '/libraries/{libraryId}/articles' })
        .input(articleImportSchema.extend({ libraryId: resourceID }))
        .output(textSchema),
    definitions: oc
        .route({
            method: 'POST',
            path: '/texts/{textId}/definitions',
            spec: (spec) => ({
                ...spec,
                responses: {
                    ...spec.responses,
                    200: {
                        description: 'NDJSON frames; one terminal completed or failed record',
                        content: { 'application/x-ndjson': { schema: { type: 'string', format: 'binary' } } },
                    },
                },
            }),
        })
        .input(occurrenceSchema)
        .output(z.string()),
    vocabulary: oc
        .route({ method: 'POST', path: '/texts/{textId}/vocabulary' })
        .input(vocabularyInputSchema.extend({ textId: resourceID }))
        .output(z.object({ id: resourceID, libraryId: resourceID }).strict()),
    ebook: oc
        .route({ method: 'GET', path: '/texts/{textId}/ebook' })
        .input(z.object({ textId: resourceID }))
        .output(ebookSchema),
    ebookPosition: oc
        .route({ method: 'POST', path: '/texts/{textId}/ebook-position' })
        .input(z.object({ textId: resourceID, location: z.string().min(1).max(2048) }))
        .output(z.object({ saved: z.boolean() })),
    removeEbookBookmark: oc
        .route({ method: 'POST', path: '/texts/{textId}/ebook-bookmark-remove' })
        .input(z.object({ textId: resourceID, bookmarkId: z.number().int().positive() }))
        .output(z.object({ removed: z.boolean() })),
    ebookBookmark: oc
        .route({ method: 'POST', path: '/texts/{textId}/ebook-bookmarks' })
        .input(
            z.object({
                textId: resourceID,
                quote: z.string().min(1).max(16000),
                chapter: z.string().max(512).nullable(),
                location: z.string().max(2048).nullable(),
            }),
        )
        .output(ebookBookmarkSchema),
    ebookDefinitions: oc
        .route({
            method: 'POST',
            path: '/texts/{textId}/ebook-definitions',
            spec: (spec) => ({
                ...spec,
                responses: {
                    ...spec.responses,
                    200: {
                        description: 'Contextual ebook definition frames',
                        content: { 'application/x-ndjson': { schema: { type: 'string', format: 'binary' } } },
                    },
                },
            }),
        })
        .input(ebookSelectionSchema.extend({ textId: resourceID }))
        .output(z.string()),
    ebookVocabulary: oc
        .route({ method: 'POST', path: '/texts/{textId}/ebook-vocabulary' })
        .input(z.object({ textId: resourceID, completionId: resourceID, requestId: resourceID }))
        .output(z.object({ id: resourceID, libraryId: resourceID }).strict()),
    me: oc.route({ method: 'GET', path: '/me' }).output(accountSchema),
    libraryArchive: oc
        .route({ method: 'POST', path: '/libraries/{libraryId}/archive' })
        .input(z.object({ libraryId: resourceID, archived: z.boolean() }))
        .output(z.object({ archived: z.boolean() })),
    createFolder: oc.route({ method: 'POST', path: '/libraries' }).input(folderCreateSchema).output(librarySchema),
    renameFolder: oc
        .route({ method: 'POST', path: '/libraries/{libraryId}/name' })
        .input(folderRenameSchema.extend({ libraryId: resourceID }))
        .output(librarySchema),
    libraries: oc.route({ method: 'GET', path: '/libraries' }).input(pageInput).output(librariesSchema),
    texts: oc
        .route({ method: 'GET', path: '/libraries/{libraryId}/texts' })
        .input(pageInput.extend({ libraryId: resourceID }))
        .output(textsSchema),
    document: oc
        .route({ method: 'GET', path: '/texts/{textId}' })
        .input(z.object({ textId: resourceID }))
        .output(documentSchema),
    audio: oc
        .route({ method: 'GET', path: '/texts/{textId}/audio/{audioId}' })
        .input(z.object({ textId: resourceID, audioId: resourceID }))
        .output(audioSchema),
}
export { mobileErrorSchema }
export type MobileLibrary = z.infer<typeof librarySchema>
export type MobileText = z.infer<typeof textSchema>
