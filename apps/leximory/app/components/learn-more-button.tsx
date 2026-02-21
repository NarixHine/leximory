'use client'

import { Button } from '@heroui/button'
import { PiMouseSimpleDuotone } from 'react-icons/pi'

interface LearnMoreButtonProps {
    className?: string
    size?: 'sm' | 'md' | 'lg'
}

export default function LearnMoreButton({ className, size = 'lg' }: LearnMoreButtonProps) {
    const handleScrollToContent = () => {
        document.getElementById('content-section')?.scrollIntoView({
            behavior: 'smooth'
        })
    }

    return (
        <Button
            radius='full'
            variant='light'
            size={size}
            className={`animate-pulse text-default-600 hover:text-primary-600 transition-colors ${className}`}
            startContent={<PiMouseSimpleDuotone className='text-xl' />}
            onPress={handleScrollToContent}
        >
            继续
        </Button>
    )
}