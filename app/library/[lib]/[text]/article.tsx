import { getArticleData } from './data'
import { isReaderModeAtom } from '@/app/atoms'
import { commentSyntaxRegex } from '@/lib/comment'
import ScopeProvider from '@/components/jotai/scope-provider'
import { HydrationBoundary } from 'jotai-ssr'
import { contentAtom, topicsAtom, ebookAtom, textAtom, titleAtom, inputAtom, isLoadingAtom, isEditingAtom, promptAtom } from './atoms'
import Digest from './components/digest'
import EditableH from './components/editable-h'
import QuoteInAgent from './components/quote-in-agent'
import ShareButton from './components/share-button'
import Topics from './components/topics'
import { getLanguageStrategy } from '@/lib/languages'

export const Article = ({ title, text, content, topics, ebook, lib, annotating, prompt, hideControls, isPublicAndFree }: Awaited<ReturnType<typeof getArticleData>> & { 
    text: string, 
    hideControls?: boolean
 }) => {
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
            <div className='flex items-center justify-center gap-3'>
                {hideControls ? <div className='invisible'><ShareButton isPublicAndFree={isPublicAndFree} className='mb-2' /></div> : <QuoteInAgent className='mb-2' />}
                <EditableH />
                <ShareButton isPublicAndFree={isPublicAndFree} className='mb-2' />
            </div>
            <div className='flex flex-wrap gap-2 justify-center items-center'>
                {FormattedReadingTime && (
                    <div className='text-sm text-center mt-1'>
                        {FormattedReadingTime(content.replace(commentSyntaxRegex, (_, p1) => p1))}
                    </div>
                )}
                <Topics topics={topics} className='justify-center'></Topics>
            </div>
            <Digest hideImportControls={hideControls}></Digest>
        </HydrationBoundary>
    </ScopeProvider>)
}
