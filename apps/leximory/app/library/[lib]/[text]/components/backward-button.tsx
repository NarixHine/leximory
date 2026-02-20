'use client'

import LoadingIndicatorWrapper from '@/components/ui/loading-indicator-wrapper'
import { Button } from '@heroui/button'
import Link from 'next/link'
import { PiArrowLeft } from 'react-icons/pi'

export function BackwardButton({ libId }: { libId: string }) {
    return (
        <Button
            as={Link}
            color='secondary'
            href={`/library/${libId}`}
            variant='light'
            isIconOnly
            radius='full'
            className='text-default-400 mb-5 -ml-3'
            aria-label='返回'
            startContent={<LoadingIndicatorWrapper variant='spinner'><PiArrowLeft className='size-6' /></LoadingIndicatorWrapper>}
        />
    )
}
