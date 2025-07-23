import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import H from '@/components/ui/h'
import TextList from './components/text-list'
import { authReadToLib } from '@/server/auth/role'
import { getTexts } from '@/server/db/text'
import { LibProps } from '@/lib/types'
import { Button } from '@heroui/button'
import { PiUsers, PiSortAscending, PiPrinter } from 'react-icons/pi'
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
        <H fancy className='mb-4 text-5xl'>{name}</H>
        <div className='flex justify-center mb-5 gap-1 flex-wrap'>
            <Button variant='light' startContent={<PiPrinter />} as={Link} href={`/library/${lib}/all-of-it`}>
                打印文库
            </Button>
            {isOwner && access === libAccessStatusMap.public && <Button variant='light' startContent={<PiUsers />} as={Link} href={`/library/${lib}/readers`}>
                查看读者
            </Button>}
            {isOwner && <Button variant='light' startContent={<PiSortAscending />} as={Link} href={`/library/${lib}/order`}>
                文本排序
            </Button>}
        </div>
        <TextList texts={texts.map(t => ({ ...t, topics: t.topics ?? [] }))} isReadOnly={isReadOnly} />
    </Main>
}
