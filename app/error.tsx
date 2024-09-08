'use client'

import Center from '@/components/center'
import H from '@/components/h'
import { Button } from '@nextui-org/button'
import { Spacer } from '@nextui-org/spacer'


export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <Center>
            <div className='text-center'>
                <H>Error</H>
                <Spacer></Spacer>
                {error.digest && <p>ID: {error.digest}</p>}
                <Spacer></Spacer>
                <Button fullWidth onPress={reset} variant='flat' color='primary'>
                    Reload
                </Button>
            </div>
        </Center>
    )
}
