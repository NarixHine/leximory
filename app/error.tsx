'use client'

import Center from '@/components/center'
import H from '@/components/h'
import { Spacer } from '@nextui-org/spacer'
import { Button } from '@nextui-org/button'
import { PiArrowClockwiseDuotone } from 'react-icons/pi'

export default function Error({
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
                <Button fullWidth onPress={reset} variant='flat' startContent={<PiArrowClockwiseDuotone />} color='primary'>
                    Reload
                </Button>
            </div>
        </Center>
    )
}
