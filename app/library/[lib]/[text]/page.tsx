import Main from '@/components/ui/main'
import Digest from './components/digest'
import EditableH from './components/editable-h'
import Nav from '@/components/nav'
import Topics from './components/topics'
import { HydrationBoundary } from 'jotai-ssr'
import { contentAtom, ebookAtom, textAtom, topicsAtom, titleAtom, inputAtom, isLoadingAtom, isEditingAtom, promptAtom } from './atoms'
import { getTextContent, getTextAnnotationProgress } from '@/server/db/text'
import { LibAndTextProps } from '@/lib/types'
import ScopeProvider from '@/components/jotai/scope-provider'
import { isReaderModeAtom } from '@/app/atoms'
import { authReadToText } from '@/server/auth/role'
import { getLanguageStrategy } from '@/lib/languages'
import { commentSyntaxRegex } from '@/lib/comment'
import ShareButton from './components/share-button'
import QuoteInAgent from './components/quote-in-agent'

export async function generateMetadata(props: LibAndTextProps) {
    const params = await props.params
    const { title } = await getTextContent({ id: params.text })
    return {
        title: typeof title === 'string' && title !== '' ? title : '新文本'
    }
}

const getData = async (text: string) => {
    await authReadToText(text)
    const { title, content, topics, ebook, lib, prompt } = await getTextContent({ id: text })
    const annotating = await getTextAnnotationProgress({ id: text })
    return { title, content, topics, ebook, lib, annotating, prompt }
}

export default async function Page(props: LibAndTextProps) {
    const { text } = await props.params
    const { title, content, topics, ebook, lib, annotating, prompt } = await getData(text)

    const { FormattedReadingTime } = getLanguageStrategy(lib.lang)
    return (<ScopeProvider atoms={[contentAtom, topicsAtom, ebookAtom, textAtom, titleAtom, inputAtom, isLoadingAtom, isReaderModeAtom, isEditingAtom, promptAtom]}>
        <HydrationBoundary hydrateAtoms={[
            [contentAtom, content.replaceAll('>', '>')],
            [topicsAtom, topics ?? []],
            [ebookAtom, ebook],
            [textAtom, text],
            [titleAtom, title],
            [inputAtom, ''],
            [isLoadingAtom, annotating === 'annotating' || annotating === 'saving'],
            [promptAtom, prompt]
        ]}>
            <Main className='max-w-screen-lg [counter-reset:sidenote-counter] md:pb-4'>
                <Nav lib={{ id: lib.id, name: lib.name }} text={{ id: text, name: title }}></Nav>
                <div className='group flex items-center justify-center gap-3'>
                    <QuoteInAgent />
                    <EditableH />
                    <ShareButton />
                </div>
                <div className='flex flex-wrap gap-2 justify-center items-center'>
                    {FormattedReadingTime && (
                        <div className='text-sm text-center mt-1'>
                            {FormattedReadingTime(content.replace(commentSyntaxRegex, (_, p1) => p1))}
                        </div>
                    )}
                    <Topics topics={topics} className='justify-center'></Topics>
                </div>
                <Digest></Digest>
            </Main>
        </HydrationBoundary>
    </ScopeProvider>)
}
