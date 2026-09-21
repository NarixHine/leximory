import 'server-only'
import type { Feature, FeatureCollection } from 'geojson'
import countries from './countries.json'

/**
 * Natural Earth 1:110m country polygons, stripped to `{ iso, name }` properties.
 * Source: https://github.com/nvkelso/natural-earth-vector (public domain).
 */
const collection = countries as unknown as FeatureCollection

const featuresByIso = new Map<string, Feature>(
    collection.features.map(feature => [
        String((feature.properties as { iso: string }).iso).toUpperCase(),
        feature,
    ]),
)

/** Returns the country outline for an ISO 3166-1 alpha-2 code, or null. */
export function getCountryFeature(iso: string | null): Feature | null {
    if (!iso) return null
    return featuresByIso.get(iso.trim().toUpperCase()) ?? null
}
