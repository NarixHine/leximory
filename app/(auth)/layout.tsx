import Center from '@/components/ui/center'
import { getSession } from '@/server/auth/user'
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'

export default async function Layout({ children }: { children: ReactNode }) {
    if (await getSession()) {
        redirect('/library')
    }
    return <Center className='max-w-none flex flex-col lg:flex-row gap-4 overflow-hidden'>
        <div className='lg:basis-1/2'>
            {children}
        </div>
        <img src='/imagery/home.webp' alt='Library illustration' className='hidden h-[calc(100dvh-80px)] w-auto rounded-2xl lg:block' />
    </Center>
}
