import { getArticleData } from './data'
import { isReaderModeAtom } from '@/app/atoms'
import ScopeProvider from '@/components/jotai/scope-provider'
import { HydrationBoundary } from 'jotai-ssr'
import { contentAtom, topicsAtom, ebookAtom, textAtom, titleAtom, inputAtom, isLoadingAtom, isEditingAtom, promptAtom, emojiAtom } from './atoms'
import Digest from './components/digest'
import QuoteInAgent from './components/quote-in-agent'
import { ArticleHero } from './components/article-hero'
import { ArticleHeading } from './components/heading'

export const Article = ({ title, text, content, topics, ebook, emoji, createdAt, lib, annotating, prompt, hideControls, isPublicAndFree }: Awaited<ReturnType<typeof getArticleData>> & {
    text: string,
    hideControls?: boolean
}) => {
    return (<ScopeProvider atoms={[contentAtom, topicsAtom, ebookAtom, textAtom, titleAtom, inputAtom, isLoadingAtom, isReaderModeAtom, isEditingAtom, promptAtom, emojiAtom]}>
        <HydrationBoundary hydrateAtoms={[
            [contentAtom, content.replaceAll('>', '>')],
            [topicsAtom, topics ?? []],
            [ebookAtom, ebook],
            [textAtom, text],
            [titleAtom, title],
            [inputAtom, ''],
            [isLoadingAtom, annotating === 'annotating' || annotating === 'saving'],
            [promptAtom, prompt],
            [emojiAtom, emoji]
        ]}>
            <ArticleHero
                hasEbook={!!ebook}
                title={title}
                topics={topics ?? []}
                lang={lib.lang}
                content={content}
                createdAt={createdAt}
                libId={lib.id}
            />
            <ArticleHeading hideControls={hideControls} isPublicAndFree={isPublicAndFree} quoteInAgent={<QuoteInAgent className='mb-2 print:invisible' />} />
            <div className='px-5 sm:w-5/6 mx-auto'>
                <Digest hideImportControls={hideControls}></Digest>
            </div>
        </HydrationBoundary>
    </ScopeProvider>)
}
