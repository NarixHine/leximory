import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import H from '@/components/ui/h'
import UserAvatar from '@/components/avatar'
import { PiUsersDuotone } from 'react-icons/pi'
import { getLib } from '@/server/db/lib'
import { authWriteToLib } from '@/server/auth/role'
import { LibProps } from '@/lib/types'

async function getData(lib: string) {
    await authWriteToLib(lib)
    const { name, starred_by } = await getLib({ id: lib })
    return { readers: starred_by ?? [], name }
}

export default async function Page(props: LibProps) {
    const params = await props.params
    const { lib } = params
    const { readers, name } = await getData(lib)

    return <Main>
        <Nav lib={{ id: lib, name }}></Nav>
        <div className='flex items-center gap-2 mb-5 justify-center'>
            <PiUsersDuotone className='text-2xl' />
            <H className='text-3xl'>读者</H>
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-fit mx-auto'>
            {readers.map((uid) => (
                <UserAvatar key={uid} uid={uid} showInfo />
            ))}
        </div>
    </Main>
} 
