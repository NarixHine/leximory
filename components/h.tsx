import { zh, lora } from '@/lib/fonts'
import { cn } from '@/lib/utils'

function H({ children, className, disableCenter, useSerif }: {
    children: string,
    className?: string,
    disableCenter?: boolean,
    useSerif?: boolean
}) {
    return <h1
        style={{
            fontFamily: useSerif ? `${lora.style.fontFamily}, ${zh.style.fontFamily}` : undefined
        }}
        className={cn('text-balance', !disableCenter && 'text-center', className ?? 'text-5xl')}
    >{children}</h1>
}

export default H
