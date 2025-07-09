import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import H from '@/components/ui/h'
import Text, { AddTextButton } from './components/text'
import { authReadToLib } from '@/server/auth/role'
import { getTexts } from '@/server/db/text'
import { LibProps } from '@/lib/types'
import { Button } from '@heroui/button'
import { PiBookOpen, PiUsers } from 'react-icons/pi'
import Link from 'next/link'
import { libAccessStatusMap } from '@/lib/config'

async function getData(lib: string) {
    const { name, isReadOnly, isOwner, access } = await authReadToLib(lib)
    const texts = await getTexts({ lib })
    return { texts, name, isReadOnly, isOwner, access }
}

export default async function Page(props: LibProps) {
    const params = await props.params
    const { lib } = params
    const { texts, name, isReadOnly, isOwner, access } = await getData(lib)

    return <Main>
        <Nav lib={{ id: lib, name }}></Nav>
        <H usePlayfair className='mb-4 text-5xl font-semibold'>{name}</H>
        <div className='flex justify-center mb-5 gap-2'>
            <Button variant='light' startContent={<PiBookOpen />} as={Link} href={`/library/${lib}/all-of-it`}>
                打印所有文章
            </Button>
            {isOwner && access === libAccessStatusMap.public && <Button variant='light' startContent={<PiUsers />} as={Link} href={`/library/${lib}/readers`}>
                查看所有读者
            </Button>}
        </div>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
            {texts.map(({ title, id, topics, hasEbook, createdAt }) => (
                <Text
                    id={id}
                    key={id}
                    title={title}
                    topics={topics ?? []}
                    hasEbook={hasEbook}
                    createdAt={createdAt}
                ></Text>
            ))}
            {!isReadOnly && <AddTextButton />}
        </div>
    </Main>
}
