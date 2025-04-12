import { auth, currentUser } from '@clerk/nextjs/server'
import NavBreadcrumbs from './breadcrumbs'
import { Suspense } from 'react'
import { PiBellDuotone } from 'react-icons/pi'
import { Button } from '@heroui/button'

export type NavProps = {
    lib?: {
        id: string
        name: string
    }
    text?: {
        id: string
        name: string
    }
    isAtCorpus?: boolean
}

export default async function Nav(props: NavProps) {
    const { orgSlug } = await auth()
    const tenant = orgSlug ?? (await currentUser())!.username ?? 'You'
    return (
        <div className='sticky flex justify-center mb-6 -mt-6 top-4 z-30 left-0 w-full space-x-2 print:hidden'>
            <NavBreadcrumbs {...props} tenant={tenant} />
            <Suspense
                fallback={<Button
                    isLoading
                    isIconOnly
                    variant='flat'
                    color='primary'
                    radius='full'
                    size='sm'
                    className='opacity-70 backdrop-blur-sm'
                    startContent={<PiBellDuotone className='text-lg' />}
                />}>
            </Suspense>
        </div>
    )
}
