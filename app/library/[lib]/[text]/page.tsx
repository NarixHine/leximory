import Main from '@/components/ui/main'
import Digest from './components/digest'
import EditableH from './components/editable-h'
import Nav from '@/components/nav'
import Topics from './components/topics'
import { HydrationBoundary } from 'jotai-ssr'
import { contentAtom, ebookAtom, textAtom, topicsAtom, titleAtom, inputAtom, isLoadingAtom } from './atoms'
import { getTextContent } from '@/server/db/text'
import { LibAndTextProps } from '@/lib/types'
import ScopeProvider from '@/components/jotai/scope-provider'
import { isReaderModeAtom } from '@/app/atoms'
import { authReadToText } from '@/server/auth/role'

export async function generateMetadata(props: LibAndTextProps) {
    const params = await props.params
    const { title } = await getTextContent({ id: params.text })
    return {
        title: typeof title === 'string' && title !== '' ? title : '新文本'
    }
}

const getData = async (text: string) => {
    await authReadToText(text)
    const { title, content, topics, ebook, lib } = await getTextContent({ id: text })
    return { title, content, topics, ebook, lib }
}

export default async function Page(props: LibAndTextProps) {
    const { text } = await props.params
    const { title, content, topics, ebook, lib } = await getData(text)

    return (<ScopeProvider atoms={[contentAtom, topicsAtom, ebookAtom, textAtom, titleAtom, inputAtom, isLoadingAtom, isReaderModeAtom]}>
        <HydrationBoundary hydrateAtoms={[
            [contentAtom, content.replaceAll('&gt;', '>')],
            [topicsAtom, topics ?? []],
            [ebookAtom, ebook],
            [textAtom, text],
            [titleAtom, title],
            [inputAtom, '']
        ]}>
            <Main className='max-w-screen-xl [counter-reset:sidenote-counter] md:pb-4'>
                <Nav lib={{ id: lib.id, name: lib.name }} text={{ id: text, name: title }}></Nav>
                <EditableH></EditableH>
                <Topics topics={topics} className='justify-center'></Topics>
                <Digest></Digest>
            </Main>
        </HydrationBoundary>
    </ScopeProvider>)
}
