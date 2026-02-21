import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { CircularProgress } from '@heroui/progress'

const GradientCard = ({ text, className, title, children, caption }: {
    title?: string | ReactNode,
    text?: string | ReactNode,
    className?: string,
    children?: ReactNode,
    isLoading?: boolean
    caption?: string | ReactNode
}) => {
    return (
        <div className={cn(
            'h-24',
            className ?? 'bg-linear-to-br from-default-50 to-default-100',
            'p-3.5 relative rounded-2xl'
        )}>
            {
                title
                    ? <h1 className={'opacity-80 font-formal text-sm'}>{title}<span className='text-xs align-baseline'>{caption}</span></h1>
                    : <div className='h-3 w-16 my-1 animate-pulse rounded-full bg-default-200/60' />
            }
            {
                text
                    ? <div className='opacity-60'>{text}</div>
                    : <div className='h-2 w-24 my-2 animate-pulse rounded-full bg-default-200/60' />
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
