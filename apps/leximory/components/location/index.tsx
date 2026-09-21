'use client'

import { memo, useMemo } from 'react'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { Chip } from '@heroui/chip'
import { Spinner } from '@heroui/spinner'
import { useAtomValue } from 'jotai'
import type { Feature } from 'geojson'
import { langAtom } from '@/app/library/[lib]/atoms'
import { detectLocation, generateLocation } from '@/service/location'
import { LOCATION_CONFIDENCE_THRESHOLD, type LocationPayload } from '@/lib/location'
import { Map, MapControls, MapGeoJSON, MapMarker, MarkerContent, useMap } from '@/components/map'
import { cn } from '@/lib/utils'
import { Lang } from '@repo/env/config'

/** Stable paint objects — the map must not repaint while the annotation streams. */
const HIGHLIGHT_PAINT = {
    light: {
        fillPaint: { 'fill-color': '#1f2125', 'fill-opacity': 0.22 },
        linePaint: { 'line-color': '#1f2125', 'line-width': 1.25, 'line-opacity': 0.9 },
    },
    dark: {
        fillPaint: { 'fill-color': '#a1a1aa', 'fill-opacity': 0.22 },
        linePaint: { 'line-color': '#d4d4d8', 'line-width': 1.25, 'line-opacity': 0.9 },
    },
}

/** The Jev gate runs as soon as the tray opens, in parallel with the annotation. */
const detectionQueryOptions = (prompt: string) =>
    queryOptions({
        queryKey: ['location-detection', prompt],
        queryFn: () => detectLocation({ prompt }),
        staleTime: Infinity,
        enabled: prompt.length > 0,
    })

/** Only fired once the gate says the selection actually names a place. */
const locationQueryOptions = (prompt: string, lang: Lang, enabled: boolean) =>
    queryOptions({
        queryKey: ['location', prompt, lang],
        queryFn: () => generateLocation({ prompt, lang }),
        staleTime: Infinity,
        enabled: enabled && prompt.length > 0,
    })

const bboxFeature = (bbox: number[]): Feature => ({
    type: 'Feature',
    properties: {},
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [bbox[0], bbox[1]],
                [bbox[2], bbox[1]],
                [bbox[2], bbox[3]],
                [bbox[0], bbox[3]],
                [bbox[0], bbox[1]],
            ],
        ],
    },
})

const featureBounds = (feature: Feature) => {
    const bbox = feature.properties?.bbox as number[] | undefined
    if (!bbox || bbox.length !== 4) return null
    return [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
    ] as [[number, number], [number, number]]
}

/** Fits the view to the mentioned feature only — never its containing country. */
const viewFor = (location: LocationPayload) => {
    if (location.feature) {
        const bounds = featureBounds(location.feature)
        if (bounds) return { bounds }
    }
    if (location.bbox && location.bbox.length === 4) {
        return {
            bounds: [
                [location.bbox[0], location.bbox[1]],
                [location.bbox[2], location.bbox[3]],
            ] as [[number, number], [number, number]],
        }
    }
    if (location.lat !== null && location.lng !== null) {
        return { center: [location.lng, location.lat] as [number, number], zoom: 9 }
    }
    return {}
}

function LocationHighlight({ data }: { data: Feature }) {
    const { resolvedTheme } = useMap()
    const { fillPaint, linePaint } = HIGHLIGHT_PAINT[resolvedTheme] ?? HIGHLIGHT_PAINT.light

    return <MapGeoJSON data={data} fillPaint={fillPaint} linePaint={linePaint} />
}

/**
 * Memoized so the frequent annotation stream re-renders in the parent never
 * touch the MapLibre source/layers. `location` is a stable query-data object.
 */
const ResolvedLocationMap = memo(function ResolvedLocationMap({
    location,
}: {
    location: LocationPayload
}) {
    const highlight = useMemo(
        () => location.feature ?? (location.bbox ? bboxFeature(location.bbox) : null),
        [location],
    )
    const point =
        !highlight && location.lat !== null && location.lng !== null
            ? { lat: location.lat, lng: location.lng }
            : null

    if (!highlight && !point) return null

    return (
        <div className='relative isolate h-44 overflow-hidden rounded-2xl'>
            <Map
                key={`${location.label}:${location.lat},${location.lng},${location.bbox?.join()}`}
                className='h-full w-full overflow-hidden rounded-2xl'
                fitBoundsOptions={{ padding: 28 }}
                scrollZoom={false}
                {...viewFor(location)}
            >
                <MapControls showZoom position='bottom-right' />
                {highlight && <LocationHighlight data={highlight} />}
                {point && (
                    <MapMarker longitude={point.lng} latitude={point.lat}>
                        <MarkerContent>
                            <span className='bg-primary ring-primary/20 block size-3.5 rounded-full ring-4' />
                        </MarkerContent>
                    </MapMarker>
                )}
            </Map>
            <Chip
                size='sm'
                variant='flat'
                color='default'
                className='font-mono text-default-600 bg-content1/40 absolute top-2 left-2 z-10 max-w-[calc(100%-1rem)] backdrop-blur-sm'
            >
                <span className='truncate'>{location.label}</span>
            </Chip>
        </div>
    )
})

/**
 * Renders the place named by the selected text inside the Define tray. The map
 * is only mounted once the reveal card is open, so tiles never load unseen.
 */
export default function LocationMap({
    prompt,
    revealed,
    ready = true,
    className,
}: {
    prompt: string
    revealed?: boolean
    /** False while the annotation is still streaming; nothing may render then. */
    ready?: boolean
    className?: string
}) {
    const lang = useAtomValue(langAtom)

    const detection = useQuery(detectionQueryOptions(prompt))
    const isLocation =
        detection.data && 'isLocation' in detection.data ? detection.data.isLocation : false
    const resolution = useQuery(locationQueryOptions(prompt, lang, isLocation))

    const resolved =
        resolution.data && 'location' in resolution.data ? resolution.data.location : null
    const location =
        resolved && resolved.confidence >= LOCATION_CONFIDENCE_THRESHOLD ? resolved : null

    // Hard guarantee: while the annotation is streaming this component does no
    // DOM, layout or WebGL work at all. The Jev gate and the resolver still run
    // in parallel, so the data is already there the moment `ready` flips.
    if (!ready) return null

    if (!prompt || !revealed || !isLocation) return null

    if (resolution.isPending || !location) {
        if (!resolution.isPending) return null
        return (
            <div
                className={cn(
                    'bg-default-100/70 mt-4 flex h-44 items-center justify-center rounded-2xl',
                    className,
                )}
            >
                <Spinner variant='dots' color='default' />
            </div>
        )
    }

    return (
        <div className={cn('animate-blur-in mt-4', className)}>
            <ResolvedLocationMap location={location} />
        </div>
    )
}
