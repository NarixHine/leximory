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
import { EmojiCover, resolveEmoji, TagPills } from '../components/text'
import { Button } from '@heroui/button'
import { PiArrowLeft } from 'react-icons/pi'
import Link from 'next/link'

/** Magazine-style article hero header. */
function ArticleHero({ title, emoji, hasEbook, topics, createdAt, textId, libId }: {
    title: string, emoji: string | null, hasEbook: boolean, topics: string[] | null, createdAt: string | null, textId: string, libId: string
}) {
    const displayEmoji = resolveEmoji(emoji, hasEbook)
    const allTopics = (topics ?? []).concat(hasEbook ? ['电子书'] : [])
    const dateStr = createdAt ? new Date(createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : null

    return (
        <div className='print:hidden'>
            {/* Mobile layout: vertical stack */}
            <div className='md:hidden mb-8'>
                <div className='flex items-center gap-3 mb-6'>
                    <Button
                        as={Link}
                        href={`/library/${libId}`}
                        variant='light'
                        isIconOnly
                        radius='full'
                        size='sm'
                        className='text-default-400'
                        aria-label='返回'
                    >
                        <PiArrowLeft className='h-4 w-4' />
                    </Button>
                </div>
                <EmojiCover
                    emoji={displayEmoji}
                    articleId={textId}
                    className='aspect-square w-full max-w-xs mx-auto rounded-2xl mb-8'
                />
                <h1 className='font-formal text-3xl leading-snug tracking-tight text-foreground text-balance mb-4'>
                    {title}
                </h1>
                {dateStr && <time className='block font-mono text-xs text-default-400 mb-3'>{dateStr}</time>}
                <TagPills tags={allTopics} />
            </div>

            {/* md+ layout: side-by-side, emoji on right, text on left */}
            <div className='hidden md:grid md:grid-cols-[1fr_1fr] md:gap-12 md:min-h-[70dvh] md:items-center mb-12'>
                <div className='flex flex-col justify-center'>
                    <Button
                        as={Link}
                        href={`/library/${libId}`}
                        variant='light'
                        isIconOnly
                        radius='full'
                        size='sm'
                        className='text-default-400 mb-8'
                        aria-label='返回'
                    >
                        <PiArrowLeft className='h-4 w-4' />
                    </Button>
                    {dateStr && <time className='block font-mono text-xs text-default-400 mb-4'>{dateStr}</time>}
                    <h1 className='font-formal text-4xl lg:text-5xl leading-tight tracking-tight text-foreground text-balance mb-6'>
                        {title}
                    </h1>
                    <TagPills tags={allTopics} />
                </div>
                <EmojiCover
                    emoji={displayEmoji}
                    articleId={textId}
                    className='aspect-square w-full rounded-2xl'
                />
            </div>
        </div>
    )
}

export const Article = ({ title, text, content, topics, ebook, emoji, createdAt, lib, annotating, prompt, hideControls, isPublicAndFree }: Awaited<ReturnType<typeof getArticleData>> & { 
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
            <ArticleHero
                title={title}
                emoji={emoji}
                hasEbook={!!ebook}
                topics={topics}
                createdAt={createdAt}
                textId={text}
                libId={lib.id}
            />
            <div className='flex items-center justify-center gap-3 print:mt-0'>
                {hideControls ? <div className='invisible'><ShareButton isPublicAndFree={isPublicAndFree} className='mb-2' /></div> : <QuoteInAgent className='mb-2 print:invisible' />}
                <EditableH />
                <ShareButton isPublicAndFree={isPublicAndFree} className='mb-2 print:invisible' />
            </div>
            <div className='flex flex-wrap gap-2 justify-center items-center'>
                {FormattedReadingTime && (
                    <div className='text-sm text-center mt-1'>
                        {FormattedReadingTime(content.replace(commentSyntaxRegex, (_, p1) => p1))}
                    </div>
                )}
                <Topics topics={topics} className='justify-center print:flex hidden'></Topics>
            </div>
            <Digest hideImportControls={hideControls}></Digest>
        </HydrationBoundary>
    </ScopeProvider>)
}
