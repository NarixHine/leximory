export const PLANS = ['beginner', 'bilingual', 'polyglot', 'leximory'] as const
export type Plan = (typeof PLANS)[number]

// Register these identifiers together in one App Store subscription group.
export const APPLE_PRODUCTS = {
    bilingual: 'com.leximory.reader.bilingual.monthly',
    polyglot: 'com.leximory.reader.polyglot.monthly',
} as const
export const APPLE_BUNDLE_ID = 'com.leximory.reader'
export function applePlan(productId: string): 'bilingual' | 'polyglot' | null {
    if (productId === APPLE_PRODUCTS.bilingual) return 'bilingual'
    if (productId === APPLE_PRODUCTS.polyglot) return 'polyglot'
    return null
}
