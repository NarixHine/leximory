import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import H from '@/components/ui/h'
import { authReadToLib } from '@/server/auth/role'
import { getTexts } from '@/server/db/text'
import { LibProps } from '@/lib/types'
import ReorderList from './components/reorder-list'
import { notFound } from 'next/navigation'

async function getData(lib: string) {
    const { name, isOwner } = await authReadToLib(lib)
    if (!isOwner) {
        notFound()
    }
    const texts = await getTexts({ lib })
    return { texts, name }
}

export default async function Page(props: LibProps) {
    const params = await props.params
    const { lib } = params
    const { texts, name } = await getData(lib)

    return (
        <Main>
            <Nav lib={{ id: lib, name }}></Nav>
            <H className='mb-4 text-5xl font-semibold'>文本排序</H>
            <p className='text-center text-default-500 mb-8'>拖拽文本以更改其顺序。</p>
            <ReorderList texts={texts} lib={lib} />
        </Main>
    )
}
