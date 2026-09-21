'use server'

import crypto from 'crypto'
import { ACTION_QUOTA_COST, type Lang } from '@repo/env/config'
import { getUserOrThrow } from '@repo/user'
import incrCommentaryQuota, { maxCommentaryQuota } from '@repo/user/quota'
import type {
    LocationDetectionResult,
    LocationPayload,
    LocationResult,
    ResolvedLocation,
} from '@/lib/location'
import { runEvaluation } from '@/server/ai/evaluate'
import { locationDetection, resolveLocation } from '@/server/ai/location'
import {
    getLocationCache,
    getLocationDetectionCache,
    setLocationCache,
    setLocationDetectionCache,
} from '@/server/db/ai-cache'
import { getCountryFeature } from '@/server/geo/countries'

const hashPrompt = (value: string) => crypto.createHash('sha256').update(value).digest('hex')

/** Jev gate: is there a mappable place in this selection? Cached per prompt. */
export async function detectLocation({
    prompt,
}: {
    prompt: string
}): Promise<LocationDetectionResult> {
    await getUserOrThrow()
    const hash = hashPrompt(prompt)

    const cached = await getLocationDetectionCache({ hash })
    if (cached !== null) return { isLocation: cached }

    // Delay the quota revalidation so it never refreshes the UI mid-annotation.
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.locationDetection, undefined, true)) {
        return { error: `本月 ${await maxCommentaryQuota()} 词点额度耗尽。` }
    }

    try {
        const { answers } = await runEvaluation(locationDetection({ prompt }))
        const isLocation = answers.hasLocation.probability >= 0.5
        await setLocationDetectionCache({ hash, isLocation })
        return { isLocation }
    } catch (error) {
        console.error('[location] detection failed', error)
        return { error: '定位失败，请稍后重试。' }
    }
}

/** Resolves the detected place into coordinates/bbox plus the country outline. */
export async function generateLocation({
    prompt,
    lang,
}: {
    prompt: string
    lang: Lang
}): Promise<LocationResult> {
    await getUserOrThrow()
    const hash = hashPrompt(`${lang}:${prompt}`)

    let resolved: ResolvedLocation
    const cached = await getLocationCache({ hash })
    if (cached !== null) {
        resolved = cached
    } else {
        if (await incrCommentaryQuota(ACTION_QUOTA_COST.location, undefined, true)) {
            return { error: `本月 ${await maxCommentaryQuota()} 词点额度耗尽。` }
        }
        try {
            resolved = await resolveLocation({ prompt, lang })
        } catch (error) {
            console.error('[location] resolution failed', error)
            return { error: '定位失败，请稍后重试。' }
        }
        await setLocationCache({ hash, location: resolved })
    }

    const location: LocationPayload = {
        ...resolved,
        feature: resolved.kind === 'country' ? getCountryFeature(resolved.countryIso) : null,
    }

    return { location }
}
