import { Plan } from '@repo/env/config'

export const PLAN_SHORT_LABEL: Record<Plan, string> = {
    beginner: 'Beginner',
    bilingual: 'Bilingual',
    polyglot: 'Polyglot',
    leximory: 'Leximory',
}

/**
 * Tier ramp for the distribution bars: neutral for the free tier, then the
 * app's secondary accent deepening as the tier rises. Keeps plan encoding on
 * the established monochrome palette instead of borrowing semantic status hues.
 */
export const PLAN_BAR: Record<Plan, string> = {
    beginner: 'bg-default-300',
    bilingual: 'bg-default-400',
    polyglot: 'bg-secondary-400',
    leximory: 'bg-secondary-600',
}
