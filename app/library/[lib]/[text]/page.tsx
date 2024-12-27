import Main from '@/components/main'
import Digest from './digest'
import { getXataClient } from '@/lib/xata'
import H from '@/components/h'
import { authReadToText } from '@/lib/auth'
import sanitizeHtml from 'sanitize-html'
import Nav from '@/components/nav'
import Topics from '@/components/topics'
import { HydrationBoundary } from 'jotai-ssr'
import { contentAtom, ebookAtom, textAtom, topicsAtom, titleAtom, inputAtom } from './atoms'

export const maxDuration = 60

export async function generateMetadata(props: LibAndTextParams) {
    const params = await props.params
    const xata = getXataClient()
    const rec = await xata.db.texts.select(['title']).filter({ id: params.text }).getFirstOrThrow()
    return {
        title: rec.title ?? '文本'
    }
}

const getData = async (text: string) => {
    const xata = getXataClient()
    await authReadToText(text)
    const rec = await xata.db.texts.filter({ id: text }).select(['title', 'content', 'lib', 'ebook', 'lib.lang', 'topics']).getFirstOrThrow()
    return rec
}

export default async function Page(props: LibAndTextParams) {
    const params = await props.params
    const { title, content, lib, id, topics, ebook, } = await getData(params.text)

    return (<HydrationBoundary hydrateAtoms={[
        [contentAtom, sanitizeHtml(content).replaceAll('&gt;', '>')],
        [topicsAtom, topics ?? []],
        [ebookAtom, ebook?.url],
        [textAtom, id],
        [titleAtom, title],
        [inputAtom, '']
    ]}>
        <Main className='max-w-screen-xl'>
            <Nav lib={{ id: lib!.id, name: lib!.name }} text={{ id: params.text, name: title }}></Nav>
            <H useNoto className={'sm:text-4xl mb-2 text-3xl'}>{title}</H>
            <Topics topics={topics}></Topics>
            <Digest></Digest>
        </Main>
    </HydrationBoundary>)
}
