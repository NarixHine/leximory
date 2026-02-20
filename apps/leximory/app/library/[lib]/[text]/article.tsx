import { getArticleData } from './data'
import { isReaderModeAtom } from '@/app/atoms'
import { commentSyntaxRegex } from '@/lib/comment'
import ScopeProvider from '@/components/jotai/scope-provider'
import { HydrationBoundary } from 'jotai-ssr'
import { contentAtom, topicsAtom, ebookAtom, textAtom, titleAtom, inputAtom, isLoadingAtom, isEditingAtom, promptAtom, emojiAtom } from './atoms'
import Digest from './components/digest'
import EditableH from './components/editable-h'
import QuoteInAgent from './components/quote-in-agent'
import ShareButton from './components/share-button'
import { getLanguageStrategy } from '@/lib/languages'
import { EmojiCover, TagPills } from '../components/text'
import { resolveEmoji } from '@/lib/utils'
import { BackwardButton } from './components/backward-button'
import { DateTime } from 'luxon'
import { Lang } from '@repo/env/config'

/** Magazine-style article hero header. */
function ArticleHero({ title, emoji, topics, createdAt, textId, libId, lang, content }: {
    title: string, emoji: string | null, topics: string[], createdAt: string | null, textId: string, libId: string, lang: Lang, content: string
}) {
    const { FormattedReadingTime } = getLanguageStrategy(lang)
    const displayEmoji = resolveEmoji(emoji, false)
    const dateStr = createdAt ? DateTime.fromISO(createdAt).toFormat('MMMM dd, yyyy') : null

    return (
        <div className='print:hidden hidden md:block w-full'>
            {/* md+ layout: side-by-side, emoji on right, text on left */}
            <div className='hidden md:grid md:grid-cols-[1fr_1fr] md:gap-12 md:min-h-dvh md:items-center md:mb-12'>
                <div className='flex flex-col max-w-[calc(40dvw)] mx-auto place-self-end pb-15'>
                    <BackwardButton libId={libId} />
                    {dateStr && <time className='block text-lg text-secondary-400 mb-4'>{dateStr}</time>}
                    <h1 className='font-formal text-4xl leading-tight tracking-tight text-foreground text-balance mb-4'>
                        {title}
                    </h1>
                    {FormattedReadingTime && (
                        <div className='text-sm mb-4'>
                            {FormattedReadingTime(content.replace(commentSyntaxRegex, (_, p1) => p1))}
                        </div>
                    )}
                    <TagPills tags={topics} size='md' color='secondary' className='text-sm text-secondary-400 border-1 border-secondary-300' />
                </div>
                <EmojiCover
                    emoji={displayEmoji}
                    articleId={textId}
                    className='w-full h-full rounded-2xl'
                />
            </div>
        </div>
    )
}

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
            {!ebook && <ArticleHero
                title={title}
                emoji={emoji}
                topics={topics ?? []}
                lang={lib.lang}
                content={content}
                createdAt={createdAt}
                textId={text}
                libId={lib.id}
            />}
            <div className='flex items-center justify-center gap-3 print:mt-0 px-5 md:w-5/6 mx-auto'>
                {hideControls ? <div className='invisible'><ShareButton isPublicAndFree={isPublicAndFree} className='mb-2' /></div> : <QuoteInAgent className='mb-2 print:invisible' />}
                <EditableH />
                <ShareButton isPublicAndFree={isPublicAndFree} className='mb-2 print:invisible' />
            </div>
            <div className='px-5 md:w-5/6 mx-auto'>
                <Digest hideImportControls={hideControls}></Digest>
            </div>
        </HydrationBoundary>
    </ScopeProvider>)
}
