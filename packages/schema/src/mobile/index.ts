import { z } from 'zod'

export const utf16RangeSchema = z.object({
    location: z.int().nonnegative(),
    length: z.int().positive(),
}).strict()

const spanBase = { range: utf16RangeSchema }
export const renderSpanSchema = z.discriminatedUnion('kind', [
    z.object({ ...spanBase, kind: z.literal('strong') }).strict(),
    z.object({ ...spanBase, kind: z.literal('emphasis') }).strict(),
    z.object({ ...spanBase, kind: z.literal('code') }).strict(),
    z.object({ ...spanBase, kind: z.literal('smallcaps') }).strict(),
    z.object({ ...spanBase, kind: z.literal('link'), url: z.url() }).strict(),
    z.object({ ...spanBase, kind: z.literal('ruby'), pronunciation: z.string().min(1) }).strict(),
    z.object({
        ...spanBase, kind: z.literal('definition'), lemma: z.string().min(1),
        definition: z.string().min(1), etymology: z.string().nullable(), cognates: z.string().nullable(),
    }).strict(),
    z.object({ ...spanBase, kind: z.literal('image'), url: z.url(), alt: z.string() }).strict(),
])

export const renderBlockSchema = z.object({
    id: z.string().min(1),
    kind: z.enum(['paragraph', 'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6', 'quote', 'listItem', 'code', 'fallback', 'divider']),
    sourceRange: utf16RangeSchema,
    displayText: z.string(),
    spans: z.array(renderSpanSchema),
    audioId: z.string().regex(/^[A-Za-z0-9_-]+$/).nullable(),
    notice: z.string().nullable(),
}).strict()

export const renderDocumentSchema = z.object({
    version: z.literal(1),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    source: z.string(),
    blocks: z.array(renderBlockSchema),
}).strict()

export type UTF16Range = z.infer<typeof utf16RangeSchema>
export type RenderSpan = z.infer<typeof renderSpanSchema>
export type RenderBlock = z.infer<typeof renderBlockSchema>
export type RenderDocument = z.infer<typeof renderDocumentSchema>

export const occurrenceSchema = z.object({
    textId: z.string().min(1).max(128),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    blockId: z.string().min(1).max(128),
    range: utf16RangeSchema,
}).strict()
export type Occurrence = z.infer<typeof occurrenceSchema>

export const mobileSubjectSchema = z.object({
    userId: z.string().min(1).max(128).brand<'MobileUserID'>(),
}).strict()
export type MobileSubject = z.infer<typeof mobileSubjectSchema>

export const mobileErrorCodeSchema = z.enum([
    'unauthenticated', 'inaccessible', 'invalid_input', 'stale_revision',
    'quota_exceeded', 'unsupported_format', 'service_unavailable',
])
export const mobileErrorSchema = z.object({
    error: z.object({
        code: mobileErrorCodeSchema,
        message: z.string(),
        retryable: z.boolean(),
    }).strict(),
}).strict()
export type MobileErrorCode = z.infer<typeof mobileErrorCodeSchema>
export type MobileErrorBody = z.infer<typeof mobileErrorSchema>
