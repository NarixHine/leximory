import Main from '@/components/ui/main'
import Digest from './components/digest'
import EditableH from './components/editable-h'
import Nav from '@/components/nav'
import Topics from './components/topics'
import { HydrationBoundary } from 'jotai-ssr'
import { contentAtom, ebookAtom, textAtom, topicsAtom, titleAtom, inputAtom, isLoadingAtom, isEditingAtom } from './atoms'
import { getTextContent, getTextAnnotationProgress } from '@/server/db/text'
import { LibAndTextProps } from '@/lib/types'
import ScopeProvider from '@/components/jotai/scope-provider'
import { isReaderModeAtom } from '@/app/atoms'
import { authReadToText } from '@/server/auth/role'
import { languageStrategies } from '@/lib/languages'

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
    const annotating = await getTextAnnotationProgress({ id: text })
    return { title, content, topics, ebook, lib, annotating }
}

export default async function Page(props: LibAndTextProps) {
    const { text } = await props.params
    const { title, content, topics, ebook, lib, annotating, } = await getData(text)


    return (<ScopeProvider atoms={[contentAtom, topicsAtom, ebookAtom, textAtom, titleAtom, inputAtom, isLoadingAtom, isReaderModeAtom, isEditingAtom]}>
        <HydrationBoundary hydrateAtoms={[
            [contentAtom, content.replaceAll('&gt;', '>')],
            [topicsAtom, topics ?? []],
            [ebookAtom, ebook],
            [textAtom, text],
            [titleAtom, title],
            [inputAtom, ''],
            [isLoadingAtom, annotating === 'annotating' || annotating === 'saving']
        ]}>
            <Main className='max-w-screen-xl [counter-reset:sidenote-counter] md:pb-4'>
                <Nav lib={{ id: lib.id, name: lib.name }} text={{ id: text, name: title }}></Nav>
                <EditableH></EditableH>
                <div className='flex flex-wrap gap-2 justify-center items-center'>
                    <Topics topics={topics} className='justify-center'></Topics>
                    {languageStrategies[lib.lang]?.FormattedReadingTime && (
                        <div className='text-sm text-center mt-1'>
                            {languageStrategies[lib.lang].FormattedReadingTime(content)}
                        </div>
                    )}
                </div>
                <Digest></Digest>
            </Main>
        </HydrationBoundary>
    </ScopeProvider>)
}
