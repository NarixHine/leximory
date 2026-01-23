import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import H from '@/components/ui/h'
import TextList from './components/text-list'
import { authReadToLib } from '@/server/auth/role'
import { getTexts } from '@/server/db/text'
import { LibProps } from '@/lib/types'
import { PiUsers, PiSortAscending, PiPrinter } from 'react-icons/pi'
import { LIB_ACCESS_STATUS } from '@repo/env/config'
import LinkButton from '@repo/ui/link-button'
import { Suspense } from 'react'
import NavBreadcrumbs from '@/components/nav/breadcrumbs'

async function getData(lib: string) {
    const [{ name, isReadOnly, isOwner, access }, texts] = await Promise.all([
        authReadToLib(lib),
        getTexts({ lib })
    ])
    return { texts, name, isReadOnly, isOwner, access }
}

async function PageContent({ params }: LibProps) {
    const { lib } = await params
    const { texts, name, isReadOnly, isOwner, access } = await getData(lib)
    return <>
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
    </>
}

export default async function Page(props: LibProps) {
    return <Main>
        <Suspense fallback={<NavBreadcrumbs loading />}>
            <PageContent params={props.params} />
        </Suspense>
    </Main>
}
