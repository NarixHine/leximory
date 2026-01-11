import { Card, CardBody, CardHeader } from '@heroui/card'
import { cn } from '@/lib/utils'
import Center from '@/components/ui/center'
import { PiImageBrokenDuotone } from 'react-icons/pi'
import { ENGLISH_SERIF } from '@/lib/fonts'
import LinkButton from '@repo/ui/link-button'

export default function NotFound() {
    return (
        <Center>
            <Card className={cn('max-w-lg', ENGLISH_SERIF.className)} isBlurred shadow='none'>
                <CardHeader className='flex flex-col items-center gap-3'>
                    <div className='flex items-center justify-center rounded-full'>
                        <PiImageBrokenDuotone className='text-5xl text-warning' />
                    </div>
                    <h2 className='text-3xl font-medium tracking-tight text-foreground/90'>
                        Page Not Found
                    </h2>
                </CardHeader>
                <CardBody className='flex flex-col items-center gap-3'>
                    <div className='flex gap-4'>
                        <LinkButton
                            href='/'
                            color='primary'
                            variant='flat'
                            className='min-w-30'
                        >
                            Return to Library
                        </LinkButton>
                    </div>
                    <div className='flex items-center justify-center gap-2 mt-5 opacity-70'>
                        <div className='h-2 w-2 rounded-full bg-primary'></div>
                        <div className='h-2 w-2 rounded-full bg-secondary'></div>
                        <div className='h-2 w-2 rounded-full bg-warning'></div>
                    </div>
                    <p className='text-center text-sm opacity-50'>
                        Error Code: 404
                    </p>
                </CardBody>
            </Card>
        </Center>
    )
}
