import Center from '@/components/ui/center'
import { getSession } from '@repo/user'
import { Image } from '@heroui/image'
import { redirect } from 'next/navigation'
import { ReactNode, Suspense } from 'react'

export default async function Layout({ children }: { children: ReactNode }) {
    return <Center className='max-w-none flex flex-col justify-center lg:flex-row gap-4 overflow-hidden'>
        <div className='lg:basis-1/2'>
            <Suspense>
                <LayoutContent>
                    {children}
                </LayoutContent>
            </Suspense>
        </div>
        <Image src='/images/home.webp' alt='Library illustration' className='hidden h-[calc(100dvh-80px)] w-auto rounded-2xl lg:block pointer-events-none' />
    </Center>
}

async function LayoutContent({ children }: { children: ReactNode }) {
    if (await getSession()) {
        redirect('/library')
    }
    return <>{children}</>
}
