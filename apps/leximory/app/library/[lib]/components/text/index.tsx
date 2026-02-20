'use client'

import { add, addAndGenerate } from './actions'
import { PiLinkSimpleHorizontal, PiKeyboard, PiPlusBold } from 'react-icons/pi'
import { useForm } from 'react-hook-form'
import { useAtomValue } from 'jotai'
import { langAtom, libAtom } from '../../atoms'
import { Tabs, Tab } from '@heroui/tabs'
import { Card, CardBody, Chip, ChipProps, useDisclosure } from '@heroui/react'
import { Input } from '@heroui/input'
import Form from '@/components/form'
import Link from "next/link"
import { getLanguageStrategy } from '@/lib/languages'
import { toast } from 'sonner'
import { scrapeArticle } from '@/server/ai/scrape'
import { cn, resolveEmoji } from '@/lib/utils'
import { DateTime } from 'luxon'
import LoadingIndicatorWrapper from '@/components/ui/loading-indicator-wrapper'

/** Stable hash (djb2 variant). Bitwise OR with 0 converts to 32-bit int to prevent overflow. */
function hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash + char) | 0
    }
    return Math.abs(hash)
}

/**
 * OKLCH background tuned to Morandi green range.
 * Light mode: hue 130–166 (sage greens), chroma 0.008–0.020 (very muted), lightness 0.94–0.98 (near-white).
 * Returns both light and dark mode variants.
 */
export function emojiBackground(id: string): { light: string, dark: string } {
    const h = hashString(id)

    // Shared calculations
    const hue = 130 + (h % 36)
    const chroma = 0.008 + (((h >> 8) % 10) / 10) * 0.012
    const lightness = 0.94 + (((h >> 16) % 10) / 10) * 0.04

    // Dark mode specific lightness logic
    const darkLightness = 0.18 + (((h >> 16) % 10) / 10) * 0.06

    return {
        // Light: Uses the calculated green hue and low chroma
        light: `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue})`,

        // Dark: Chroma set to 0 and Hue set to 0 for a neutral grey
        dark: `oklch(${darkLightness.toFixed(3)} 0 0)`
    }
}

export function TagPills({ tags, ...props }: { tags: string[] } & ChipProps) {
    if (!tags.length) return null
    return (
        <div className='flex flex-wrap gap-1.5'>
            {tags.slice(0, 3).map((tag) => (
                <Chip
                    variant='bordered'
                    color='default'
                    size='sm'
                    classNames={{
                        ...props.classNames,
                        base: cn('text-default-400 border-1 text-[10px]', props.classNames?.base),
                        content: cn('px-0.75', props.classNames?.content)
                    }}
                    key={tag}
                    {...props}
                >
                    {tag}
                </Chip>
            ))}
        </div>
    )
}

/** Emoji cover in a rounded container with hash-seeded background (supports dark mode). */
export function EmojiCover({ emoji, articleId, className = '', isLink = false }: { emoji: string, articleId: string, className?: string, isLink?: boolean }) {
    const bg = emojiBackground(articleId)
    const emojiSpan = (
        <span className='select-none leading-none' style={{ fontSize: 'min(35cqi, 35cqb)' }}>
            {emoji}
        </span>
    )
    const emojiContent = isLink
        ? <LoadingIndicatorWrapper variant='spinner' classNames={{ wrapper: 'w-[min(35cqi,35cqb)] h-[min(35cqi,35cqb)]' }}>{emojiSpan}</LoadingIndicatorWrapper>
        : emojiSpan
    return (
        <div
            className={cn('flex items-center justify-center rounded-3xl overflow-clip', className)}
            style={{ containerType: 'size' }}
        >
            <div
                className='w-full h-full flex items-center justify-center dark:hidden'
                style={{ backgroundColor: bg.light }}
            >
                {emojiContent}
            </div>
            <div
                className='w-full h-full hidden items-center justify-center dark:flex'
                style={{ backgroundColor: bg.dark }}
            >
                {emojiContent}
            </div>
        </div>
    )
}

/** Large article card with emoji above, title below. */
export function LeftCard({ id, title, topics, hasEbook, emoji }: {
    id: string, title: string, topics: string[], hasEbook: boolean, emoji: string | null
}) {
    const lib = useAtomValue(libAtom)
    const allTopics = hasEbook ? [...topics, '电子书'] : topics
    return (
        <Link href={`/library/${lib}/${id}`} className='group cursor-pointer block'>
            <EmojiCover
                emoji={resolveEmoji(emoji, hasEbook)}
                articleId={id}
                className='mb-3 aspect-4/3 w-full'
                isLink
            />
            <h2 className='mb-2.5 font-formal text-[1.35rem] leading-snug tracking-tight text-foreground text-balance'>
                {title}
            </h2>
            <TagPills tags={allTopics} />
        </Link>
    )
}

/** Center hero card — large emoji, centered title + optional subtitle. */
export function HeroCard({ id, title, topics, hasEbook, emoji, createdAt }: {
    id: string, title: string, topics: string[], hasEbook: boolean, emoji: string | null, createdAt: string
}) {
    const lib = useAtomValue(libAtom)
    const allTopics = hasEbook ? [...topics, '电子书'] : topics
    return (
        <Link href={`/library/${lib}/${id}`} className='group cursor-pointer block'>
            <EmojiCover
                emoji={resolveEmoji(emoji, hasEbook)}
                articleId={id}
                className='mb-8 aspect-4/3 w-full'
                isLink
            />
            <h2 className='mb-3 text-center font-formal text-[2rem] leading-[1.2] tracking-tight text-foreground text-balance sm:text-[2.4rem]'>
                {title}
            </h2>
            <time className='block text-center text-xl text-secondary-500 mb-4'>
                {DateTime.fromISO(createdAt).toFormat('MMMM dd, yyyy')}
            </time>
            <div className='flex justify-center'>
                <TagPills tags={allTopics} />
            </div>
        </Link>
    )
}

/** Right-side compact card — title left, emoji right. */
export function RightCard({ id, title, topics, hasEbook, emoji }: {
    id: string, title: string, topics: string[], hasEbook: boolean, emoji: string | null
}) {
    const lib = useAtomValue(libAtom)
    const allTopics = hasEbook ? [...topics, '电子书'] : topics
    return (
        <Link href={`/library/${lib}/${id}`} className='group flex cursor-pointer gap-4'>
            <div className='flex min-w-0 flex-1 flex-col justify-center'>
                <h2 className='mb-2 font-formal text-[0.95rem] leading-snug tracking-tight text-foreground text-balance'>
                    {title}
                </h2>
                <TagPills tags={allTopics} />
            </div>
            <EmojiCover
                emoji={resolveEmoji(emoji, hasEbook)}
                articleId={id}
                className='h-22 w-22 shrink-0'
                isLink
            />
        </Link>
    )
}

/** Compact card for additional articles below hero. */
export function CompactCard({ id, title, topics, hasEbook, emoji }: {
    id: string, title: string, topics: string[], hasEbook: boolean, emoji: string | null
}) {
    const lib = useAtomValue(libAtom)
    const allTopics = hasEbook ? [...topics, '电子书'] : topics
    return (
        <Link href={`/library/${lib}/${id}`} className='group flex cursor-pointer gap-3'>
            <div className='flex min-w-0 flex-1 flex-col justify-center'>
                <h3 className='mb-1.5 font-formal text-[0.9rem] leading-snug tracking-tight text-foreground text-balance'>
                    {title}
                </h3>
                <TagPills tags={allTopics} />
            </div>
            <EmojiCover
                emoji={resolveEmoji(emoji, hasEbook)}
                articleId={id}
                className='h-16 w-16 shrink-0'
                isLink
            />
        </Link>
    )
}

/** 新建文章 add button — appears as a plus icon in grid. */
export function AddTextButton() {
    const lib = useAtomValue(libAtom)
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const { register, handleSubmit, setValue, formState } = useForm<{ url: string, title: string }>({
        defaultValues: { url: '', title: '' }
    })
    const lang = useAtomValue(langAtom)

    return <>
        <Card
            isPressable
            onPress={onOpen}
            shadow='none'
            className='p-0 bg-default-100'
        >
            <CardBody
                className='group p-0 flex aspect-2/1 w-full cursor-pointer items-center justify-center rounded-xl transition-colors'
            >
                <PiPlusBold className='h-8 w-8 text-default-400 transition-transform group-hover:scale-110' />
            </CardBody>
        </Card>
        <Form
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title='创建文章'
            isLoading={formState.isSubmitting}
            onSubmit={handleSubmit(async (data) => {
                if (data.url) {
                    try {
                        const { title, content } = await scrapeArticle(data.url)
                        if (content.length > getLanguageStrategy(lang).maxArticleLength) {
                            toast.error('识别内容过长，请手动录入')
                            return
                        }
                        addAndGenerate({ title, content, lib })
                    } catch {
                        toast.error('文章解析失败，请手动录入')
                    }
                } else if (data.title) {
                    await add({ title: data.title, lib })
                }
            })}
        >
            <Tabs aria-label='方式'>
                <Tab
                    key='text'
                    title={
                        <div className='flex items-center space-x-2'>
                            <PiLinkSimpleHorizontal />
                            <span>网址导入外刊</span>
                        </div>
                    }
                >
                    <Input placeholder='https://www.nytimes.com/' variant='bordered' color='primary' {...register('url', {
                        onChange: () => setValue('title', '')
                    })} />
                </Tab>
                <Tab key='ebook'
                    title={
                        <div className='flex items-center space-x-2'>
                            <PiKeyboard />
                            <span>手动输入标题</span>
                        </div>
                    }
                >
                    <Input placeholder='标题' variant='bordered' color='primary' {...register('title', {
                        onChange: () => setValue('url', '')
                    })} />
                </Tab>
            </Tabs>
        </Form>
    </>
}

/** Backward-compatible default export — extra props kept for consumers outside /library. */
export default function Text({ id, title, topics, hasEbook, emoji, ...rest }: {
    id: string, title: string, topics: string[], hasEbook: boolean, emoji?: string | null,
    createdAt?: string, disablePrefetch?: boolean, disableNavigation?: boolean,
    visitStatus?: 'loading' | 'visited' | 'not-visited',
}) {
    return <CompactCard id={id} title={title} topics={topics} hasEbook={hasEbook} emoji={emoji ?? null} />
}
