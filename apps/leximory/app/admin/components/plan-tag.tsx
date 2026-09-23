import { Plan } from '@repo/env/config'
import { cn } from '@/lib/utils'
import { PLAN_SHORT_LABEL } from '../plan'

/** Neutral, monochrome tier label. Plans are distinguished by name, not hue. */
export default function PlanTag({ plan, className }: { plan: Plan; className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full bg-default-100 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-default-700',
                className,
            )}
        >
            {PLAN_SHORT_LABEL[plan]}
        </span>
    )
}
