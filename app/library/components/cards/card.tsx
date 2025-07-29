import { Skeleton } from "@heroui/skeleton"
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import H from '@/components/ui/h'
import { CircularProgress } from '@heroui/progress'

const GradientCard = ({ text, className, title, children }: {
    title?: string | ReactNode,
    text?: string | ReactNode,
    className?: string,
    children?: ReactNode,
    isLoading?: boolean
}) => {
    return (
        <div className={cn(
            'h-24',
            className ?? 'bg-gradient-to-br from-secondary-50 to-warning-50 dark:from-stone-900 dark:to-stone-700',
            'p-3.5 relative rounded-xl'
        )}>
            {
                title
                    ? <H className={'font-xl opacity-80'} fancy disableCenter>{title}</H>
                    : <Skeleton className='h-3 w-1/3 max-w-10 my-1 rounded-lg opacity-50' />
            }
            {
                text
                    ? <div className='opacity-60'>{text}</div>
                    : <Skeleton className='h-2 w-2/3 max-w-30 my-3 rounded-lg opacity-50' />
            }
            <div className='absolute bottom-0 right-0 p-3'>
                {children ?? <CircularProgress
                    value={0}
                    size='lg'
                    color='default'
                    classNames={{
                        track: 'stroke-white/50',
                    }}
                />}
            </div>
        </div>
    )
}

export default GradientCard
