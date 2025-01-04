import { CHINESE, CHINESE_ZCOOL, ENGLISH_PLAYFAIR, ENGLISH_SERIF } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

function H({ children, className, disableCenter, useNoto, usePlayfair }: {
    children: ReactNode,
    className?: string,
    disableCenter?: boolean,
    useNoto?: boolean,
    usePlayfair?: boolean
}) {
    return <h1
        style={{
            fontFamily: `${usePlayfair ? ENGLISH_PLAYFAIR.style.fontFamily : ENGLISH_SERIF.style.fontFamily}, ${useNoto ? CHINESE.style.fontFamily : CHINESE_ZCOOL.style.fontFamily}`
        }}
        className={cn('text-balance flex', !disableCenter && 'justify-center text-center', className ?? 'text-5xl')}
    ><span className={cn('flex', !disableCenter && 'justify-center text-center')}>{children}</span></h1>
}

export default H
