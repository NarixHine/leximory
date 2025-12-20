import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import H from '@/components/ui/h'
import TextList from './components/text-list'
import { authReadToLib } from '@/server/auth/role'
import { getTexts } from '@/server/db/text'
import { LibProps } from '@/lib/types'
import { PiUsers, PiSortAscending, PiPrinter } from 'react-icons/pi'
import { LIB_ACCESS_STATUS } from '@/lib/config'
import LinkButton from '@/components/ui/link-button'

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
            <LinkButton variant='light' startContent={<PiPrinter />} href={`/library/${lib}/all-of-it`}>
                打印文库
            </LinkButton>
            {isOwner && access === LIB_ACCESS_STATUS.public && <LinkButton variant='light' startContent={<PiUsers />} href={`/library/${lib}/readers`}>
                查看读者
            </LinkButton>}
            {isOwner && <LinkButton variant='light' startContent={<PiSortAscending />} href={`/library/${lib}/order`}>
                文本排序
            </LinkButton>}
        </div>
        <TextList texts={texts.map(t => ({ ...t, topics: t.topics ?? [] }))} isReadOnly={isReadOnly} />
    </Main>
}
