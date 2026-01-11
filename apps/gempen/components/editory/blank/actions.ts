'use server'

import { streamExplanation, StreamExplanationParams } from '@/server/ai/ask'
import { hashAskParams } from './utils'

export async function streamExplanationAction(params: StreamExplanationParams) {
    return streamExplanation(params)
}
