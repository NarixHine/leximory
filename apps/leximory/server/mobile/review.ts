import 'server-only'
import { z } from 'zod'
import { LangSchema } from '@repo/schema/library'
import { parseCommentParams } from '@/lib/comment'
import type { getTimelineData, getReviewStreakData } from '@/server/db/review'
import { renderDocument } from './render-document'
import { requireMobileSubject, type BearerVerifier } from './auth'
import { MobileError, mobileErrorResponse } from './errors'

const selection = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), lang: LangSchema })

type ReviewOperation = (request: Request, userId: string) => Promise<Response>
type ReviewDependencies = {
    verify: BearerVerifier
    timeline: typeof getTimelineData
    streak: typeof getReviewStreakData
    check: ReviewOperation
    start: ReviewOperation
    translation: ReviewOperation
    conversation: ReviewOperation
}

export function createReviewHandler(dependencies: ReviewDependencies) {
    return async (request: Request): Promise<Response> => {
        try {
            const { userId } = await requireMobileSubject(request, dependencies.verify)
            const url = new URL(request.url)
            const path = url.pathname.slice('/api/mobile/v1/review'.length)
            if (request.method === 'GET' && path === '') {
                const cursor = z.string().max(100).optional().parse(url.searchParams.get('cursor') ?? undefined)
                const [timeline, streak] = await Promise.all([dependencies.timeline(userId, cursor), dependencies.streak(userId)])
                const days = timeline.days.map(day => ({ ...day, words: day.words.map(word => {
                    const [original, lemma, definition, etymology, cognates] = parseCommentParams(word.word)
                    return { ...word, word: original ?? lemma ?? '', fields: definition ? {
                        original: original ?? '', lemma: lemma ?? original ?? '', definition,
                        etymology: etymology || null, cognates: cognates || null,
                    } : null }
                }) }))
                return Response.json({ ...timeline, days, streak }, { headers: { 'Cache-Control': 'private, no-store' } })
            }
            if (request.method === 'GET' && path === '/check') {
                selection.parse(Object.fromEntries(url.searchParams))
                const response = await dependencies.check(request, userId)
                if (!response.ok) return response
                const payload = z.object({ story: z.string().nullish() }).passthrough().parse(await response.json())
                return Response.json({ ...payload, storyDocument: payload.story ? renderDocument(payload.story) : null }, { headers: { 'Cache-Control': 'private, no-store' } })
            }
            if (request.method === 'POST') {
                selection.parse(await request.clone().json())
                if (path === '/start') return await dependencies.start(request, userId)
                if (path === '/translation') return await dependencies.translation(request, userId)
                if (path === '/conversation') return await dependencies.conversation(request, userId)
            }
            throw new MobileError('invalid_input')
        } catch (error) { return mobileErrorResponse(error instanceof z.ZodError ? new MobileError('invalid_input') : error) }
    }
}
