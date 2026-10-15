import 'server-only'
import { z } from 'zod'
import {
    reviewSelectionSchema,
    reviewSnapshotSchema,
    reviewTimelineSchema,
    reviewStartSchema,
    reviewTranslationSchema,
    reviewConversationSchema,
} from '@repo/api'
import { parseCommentParams } from '@/lib/comment'
import type { getTimelineData } from '@/server/db/review'
import { mobileErrorFromStatus } from './errors'
import { renderDocument } from './render-document'
import { checkedResponse, jsonBody, query, type MobileContext, type MobileOperation } from './http'

const checkPayload = reviewSnapshotSchema.omit({ storyDocument: true }).passthrough()

type ReviewBackendOperation = (request: Request, userId: string) => Promise<Response>
type ReviewDependencies = {
    timeline: typeof getTimelineData
    check: ReviewBackendOperation
    start: ReviewBackendOperation
    translation: ReviewBackendOperation
    conversation: ReviewBackendOperation
}

async function forwardSubmission(context: MobileContext, operation: ReviewBackendOperation, schema: z.ZodType) {
    query(context.request, [])
    const input = schema.parse(await jsonBody(context.request, 8192, context.signal))
    const headers = new Headers(context.request.headers)
    const body = JSON.stringify(input)
    headers.set('Content-Type', 'application/json')
    headers.delete('Content-Length')
    const request = new Request(context.request.url, {
        method: 'POST',
        headers,
        body,
        signal: context.signal,
    })
    const response = await operation(request, context.subject.userId)
    if (!response.ok) throw mobileErrorFromStatus(response.status)
    return checkedResponse(z.object({ success: z.boolean() }), await response.json())
}

export function createReviewOperations(dependencies: ReviewDependencies) {
    return {
        reviewTimeline: async ({ request, subject }) => {
            const parameters = query(request, ['cursor'])
            const cursor = z.string().max(100).optional().parse(parameters.cursor)
            const timeline = await dependencies.timeline(subject.userId, cursor)
            const days = timeline.days.map((day) => ({
                ...day,
                words: day.words.map((word) => {
                    const [original, lemma, definition, etymology, cognates] = parseCommentParams(word.word)
                    return {
                        ...word,
                        word: original ?? lemma ?? '',
                        fields: definition
                            ? {
                                  original: original ?? '',
                                  lemma: lemma ?? original ?? '',
                                  definition,
                                  etymology: etymology || null,
                                  cognates: cognates || null,
                              }
                            : null,
                    }
                }),
            }))
            return checkedResponse(reviewTimelineSchema, { ...timeline, days, nextCursor: timeline.nextCursor ?? null })
        },
        reviewCheck: async ({ request, subject, signal }) => {
            reviewSelectionSchema.parse(query(request, ['date', 'lang']))
            const response = await dependencies.check(new Request(request, { signal }), subject.userId)
            if (!response.ok) throw mobileErrorFromStatus(response.status)
            const payload = checkedResponse(checkPayload, await response.json())
            return checkedResponse(reviewSnapshotSchema, {
                ...payload,
                storyDocument: payload.story ? renderDocument(payload.story) : null,
            })
        },
        reviewStart: async (context) => forwardSubmission(context, dependencies.start, reviewStartSchema),
        reviewTranslation: async (context) =>
            forwardSubmission(context, dependencies.translation, reviewTranslationSchema),
        reviewConversation: async (context) =>
            forwardSubmission(context, dependencies.conversation, reviewConversationSchema),
    } satisfies Record<string, MobileOperation>
}
