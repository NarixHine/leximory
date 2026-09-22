import { z } from '@repo/schema'
import type { Feature } from 'geojson'

/** Geographic kinds the tray map can resolve and render. */
export const LOCATION_KINDS = ['country', 'city', 'region', 'mountain', 'sea', 'landmark'] as const

export type LocationKind = (typeof LOCATION_KINDS)[number]

/** Resolutions below this confidence are not mapped, to avoid misleading pins. */
export const LOCATION_CONFIDENCE_THRESHOLD = 0.5

/** Probability a boolean Jev question must clear before we ask the LLM to resolve. */
export const LOCATION_DETECTION_THRESHOLD = 0.5

/**
 * Structured output of the location resolver. `bbox` is `[west, south, east, north]`
 * for areal features; `lat`/`lng` pin point features. Country mentions carry an
 * ISO 3166-1 alpha-2 code so the client can draw the real border. `explanation`
 * is an optional trailing clause (max 6 words) that is displayed after the label,
 * joined with a comma, when the link to the selection is not immediately obvious.
 */
export const LocationSchema = z.object({
    label: z.string(),
    explanation: z.string().nullable(),
    kind: z.enum(LOCATION_KINDS),
    country: z.string().nullable(),
    countryIso: z.string().nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    bbox: z.array(z.number()).length(4).nullable(),
    confidence: z.number(),
})

export type ResolvedLocation = z.infer<typeof LocationSchema>

/** A resolved location plus the country outline when the mention is a country. */
export type LocationPayload = ResolvedLocation & {
    feature?: Feature | null
}

/** Typed Jev verdict: whether a place is present, and which kind it looks like. */
export type LocationDetection = { isLocation: boolean; kind: LocationKind | null }

/** Result shared by the two location server actions. */
export type LocationDetectionResult = LocationDetection | { error: string }
export type LocationResult = { location: LocationPayload } | { error: string }
