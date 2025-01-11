import Main from '@/components/ui/main'
import Digest from './components/digest'
import EditableH from './components/editable-h'
import { authReadToText } from '@/lib/auth'
import sanitizeHtml from 'sanitize-html'
import Nav from '@/components/nav'
import Topics from '@/components/topics'
import { HydrationBoundary } from 'jotai-ssr'
import { contentAtom, ebookAtom, textAtom, topicsAtom, titleAtom, inputAtom } from './atoms'
import { getTextContent } from '@/server/db/text'
import { LibAndTextParams } from '@/lib/types'

export const maxDuration = 60

export async function generateMetadata(props: LibAndTextParams) {
    const params = await props.params
    const { title } = await getTextContent({ id: params.text })
    return {
        title: title ?? '文本'
    }
}

const getData = async (text: string) => {
    await authReadToText(text)
    const { title, content, topics, ebook, lib } = await getTextContent({ id: text })
    return { title, content, topics, ebook, lib }
}

export default async function Page(props: LibAndTextParams) {
    const { text } = await props.params
    const { title, content, topics, ebook, lib } = await getData(text)

    return (<HydrationBoundary hydrateAtoms={[
        [contentAtom, sanitizeHtml(content).replaceAll('&gt;', '>')],
        [topicsAtom, topics ?? []],
        [ebookAtom, ebook?.url],
        [textAtom, text],
        [titleAtom, title],
        [inputAtom, '']
    ]}>
        <Main className='max-w-screen-xl'>
            <Nav lib={{ id: lib.id, name: lib.name }} text={{ id: text, name: title }}></Nav>
            <EditableH></EditableH>
            <Topics topics={topics}></Topics>
            <Digest></Digest>
        </Main>
    </HydrationBoundary>)
}
