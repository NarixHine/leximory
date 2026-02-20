'use client'

import { Button, Card, CardBody, CardHeader, cn } from '@heroui/react'
import Center from '@/components/ui/center'
import { PiWarningCircleDuotone } from 'react-icons/pi'
import { ENGLISH_SERIF } from '@/lib/fonts'
import LinkButton from '@repo/ui/link-button'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <Center>
            <Card className={cn('max-w-lg not-prose', ENGLISH_SERIF.className)} isBlurred shadow='none'>
                <CardHeader className='flex flex-col items-center'>
                    <div className='flex items-center justify-center rounded-full'>
                        <PiWarningCircleDuotone className='text-5xl text-danger' />
                    </div>
                </CardHeader>
                <CardBody className='flex flex-col items-center gap-6 pt-0'>
                    <p className='text-center text-lg'>
                        An error occurred. <br />
                        If the problem persists, please contact support.
                    </p>
                    <div className='flex gap-4 flex-wrap justify-center'>
                        <Button
                            color='secondary'
                            variant='light'
                            onPress={reset}
                            className='min-w-30'
                        >
                            Try Again
                        </Button>
                        <LinkButton
                            href='/'
                            color='secondary'
                            variant='light'
                            className='min-w-30'
                        >
                            Return to Library
                        </LinkButton>
                        <Button
                            href='/'
                            color='danger'
                            variant='light'
                            onPress={() => {
                                localStorage.clear()
                                reset()
                            }}
                            className='min-w-30'
                        >
                            Clear Cache
                        </Button>
                    </div>
                    <div className='flex items-center justify-center gap-2 mt-10 opacity-70'>
                        <div className='h-2 w-2 rounded-full bg-primary'></div>
                        <div className='h-2 w-2 rounded-full bg-secondary'></div>
                        <div className='h-2 w-2 rounded-full bg-default'></div>
                    </div>
                    <p className='text-center text-sm opacity-50'>
                        Digest: {error.digest ?? 'Unknown'}
                    </p>
                </CardBody>
            </Card>
        </Center>
    )
}
