import { Skeleton } from '@nextui-org/skeleton'
import { cn } from '@/lib/utils'

const GradientCard = ({ text, gradient, title, children }: {
    title?: string,
    text?: string,
    gradient?: string,
    children?: JSX.Element
}) => {
    return (
        <div className={cn('h-24', gradient ?? 'bg-gradient-to-br from-secondary-400 to-warning-300 dark:from-secondary-300', 'p-3 relative rounded-lg')}>
            {
                title
                    ? <h2 className='font-xl font-bold opacity-50'>{title}</h2>
                    : <Skeleton className='bg-default-900 h-3 w-1/3 max-w-10 my-1 rounded-lg opacity-50' />
            }
            {
                text
                    ? <p className='opacity-50'>{text}</p>
                    : <Skeleton className='bg-default-900 h-2 w-2/3 max-w-30 my-3 rounded-lg opacity-50' />
            }
            <div className='absolute bottom-0 right-0 p-4'>
                {children}
            </div>
        </div>
    )
}

export default GradientCard
