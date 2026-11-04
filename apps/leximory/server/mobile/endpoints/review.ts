import 'server-only'
import { ACTION_QUOTA_COST } from '@repo/env/config'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { requireCommentaryQuota } from '../quota-store'
import { createReviewOperations } from '../review'
import { getTimelineData } from '@/server/db/review'
import { checkReview } from '@/server/review/check'
import { startReview } from '@/server/review/start'
import { submitReviewTranslation } from '@/server/review/translation'
import { submitReviewConversation } from '@/server/review/conversation'

const operations = createReviewOperations({
    timeline: getTimelineData,
    check: checkReview,
    start: startReview,
    translation: submitReviewTranslation,
    conversation: submitReviewConversation,
    charge: (userId, action, signal) => requireCommentaryQuota(userId, ACTION_QUOTA_COST[action], signal),
})

export const reviewTimeline = mobileEndpoint(verify, operations.reviewTimeline, 60000)
export const reviewCheck = mobileEndpoint(verify, operations.reviewCheck, 60000)
export const reviewStart = mobileEndpoint(verify, operations.reviewStart, 60000)
export const reviewTranslation = mobileEndpoint(verify, operations.reviewTranslation, 60000)
export const reviewConversation = mobileEndpoint(verify, operations.reviewConversation, 60000)
