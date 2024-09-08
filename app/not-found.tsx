import Main from '@/components/main'
import H from '@/components/h'
import { Button } from '@nextui-org/button'
import { Spacer } from '@nextui-org/spacer'
import Link from 'next/link'

export default function NotFound() {
    return (
        <Main className='flex items-center justify-center mx-auto h-full gap-2'>
            <div className='text-center'>
                <H>404 Not Found</H>
                <Spacer></Spacer>
                <Button fullWidth href='/' as={Link} variant='flat' color='primary'>
                    回到主页
                </Button>
            </div>
        </Main>
    )
}
