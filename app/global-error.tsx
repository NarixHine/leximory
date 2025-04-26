'use client'

import { Button } from '@heroui/button'
import { cn } from '@/lib/utils'
import Center from '@/components/ui/center'
import Link from 'next/link'
import { PiWarningCircle } from 'react-icons/pi'
import { ENGLISH_SERIF } from '@/lib/fonts'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <Center>
          <div className={cn('max-w-lg', ENGLISH_SERIF.className)}>
            <div className='flex flex-col items-center gap-3'>
              <div className='flex items-center justify-center rounded-full'>
                <PiWarningCircle className='text-5xl text-danger' />
              </div>
              <h2 className='text-3xl font-medium tracking-tight text-foreground/90'>
                Error
              </h2>
              <div className='flex gap-4'>
                <Button
                  color='primary'
                  variant='flat'
                  onPress={reset}
                  className='min-w-[120px]'
                >
                  Try Again
                </Button>
                <Button
                  as={Link}
                  href='/'
                  color='secondary'
                  variant='flat'
                  className='min-w-[120px]'
                >
                  Return to Library
                </Button>
              </div>
              <div className='flex items-center justify-center gap-2 mt-5 opacity-70'>
                <div className='h-2 w-2 rounded-full bg-primary'></div>
                <div className='h-2 w-2 rounded-full bg-secondary'></div>
                <div className='h-2 w-2 rounded-full bg-destructive'></div>
              </div>
              <p className='text-center text-sm opacity-50'>
                Digest: {error.digest ?? 'Unknown'}
              </p>
            </div>
          </div>
        </Center>
      </body>
    </html>
  )
} 