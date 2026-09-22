'use server'

import crypto from 'crypto'
import { ACTION_QUOTA_COST, type Lang } from '@repo/env/config'
import { getUserOrThrow } from '@repo/user'
import incrCommentaryQuota, { maxCommentaryQuota } from '@repo/user/quota'
import {
    LOCATION_DETECTION_THRESHOLD,
    type LocationDetection,
    type LocationDetectionResult,
    type LocationKind,
    type LocationPayload,
    type LocationResult,
    type ResolvedLocation,
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
import { after } from 'next/server'

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
    if (cached !== null) return cached

    // Delay the quota revalidation so it never refreshes the UI mid-annotation.
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.locationDetection, undefined, true)) {
        return { error: `本月 ${await maxCommentaryQuota()} 词点额度耗尽。` }
    }

    try {
        const { answers } = await runEvaluation(locationDetection({ prompt }))
        const isLocation = answers.hasLocation.probability >= LOCATION_DETECTION_THRESHOLD
        const detection: LocationDetection = {
            isLocation,
            kind: isLocation ? (answers.kind.choice as LocationKind) : null,
        }
        after(async () => {
            await setLocationDetectionCache({ hash, detection })
        })
        return detection
    } catch (error) {
        console.error('[location] detection failed', error)
        return { error: '定位失败，请稍后重试。' }
    }
}

/** Resolves the detected place into coordinates/bbox plus the country outline. */
export async function generateLocation({
    prompt,
    lang,
    kind,
}: {
    prompt: string
    lang: Lang
    kind: LocationKind | null
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
            resolved = await resolveLocation({ prompt, lang, kind })
        } catch (error) {
            console.error('[location] resolution failed', error)
            return { error: '定位失败，请稍后重试。' }
        }
        after(async () => {
            await setLocationCache({ hash, location: resolved })
        })
    }

    const location: LocationPayload = {
        ...resolved,
        feature: resolved.kind === 'country' ? getCountryFeature(resolved.countryIso) : null,
    }

    return { location }
}
