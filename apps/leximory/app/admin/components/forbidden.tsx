import { Card, CardBody } from '@heroui/card'
import LinkButton from '@repo/ui/link-button'
import Center from '@/components/ui/center'
import { PiShieldWarningDuotone } from 'react-icons/pi'
import { cn } from '@/lib/utils'
import { ENGLISH_SERIF } from '@/lib/fonts'

export default function Forbidden() {
    return (
        <Center>
            <Card className={cn('max-w-lg', ENGLISH_SERIF.className)} isBlurred shadow='none'>
                <CardBody className='flex flex-col items-center gap-5 py-10'>
                    <div className='grid place-items-center size-16 rounded-full bg-danger-50'>
                        <PiShieldWarningDuotone className='size-8 text-danger-500' />
                    </div>
                    <div className='flex flex-col items-center gap-1.5 text-center'>
                        <h2 className='text-2xl font-medium tracking-tight text-foreground/90'>
                            Access restricted
                        </h2>
                        <p className='text-sm text-default-600 text-balance max-w-xs'>
                            This area is limited to the Leximory administrator. Your account does
                            not have permission to view it.
                        </p>
                    </div>
                    <LinkButton href='/library' radius='full' className='min-w-32 mt-2'>
                        Return to Library
                    </LinkButton>
                </CardBody>
            </Card>
        </Center>
    )
}
