'use client'

import LoadingIndicatorWrapper from '@/components/ui/loading-indicator-wrapper'
import { cn } from '@/lib/utils'
import { Button, ButtonProps } from '@heroui/button'
import Link from 'next/link'
import { PiArrowLeft } from 'react-icons/pi'

export function BackwardButton({ libId, className,...props }: { libId: string }&ButtonProps) {
    return (
        <Button
            as={Link}
            color='secondary'
            href={`/library/${libId}`}
            variant='light'
            isIconOnly
            radius='full'
            className={cn('text-default-400', className)}
            aria-label='返回'
            startContent={<LoadingIndicatorWrapper variant='spinner'><PiArrowLeft className='size-6' /></LoadingIndicatorWrapper>}
            {...props}
        />
    )
}
