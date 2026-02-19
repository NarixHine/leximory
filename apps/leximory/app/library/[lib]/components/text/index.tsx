'use client'

import { add, addAndGenerate } from './actions'
import { PiFilePlusDuotone, PiLinkSimpleHorizontal, PiKeyboard, PiPlusBold } from 'react-icons/pi'
import { useForm } from 'react-hook-form'
import { useAtomValue } from 'jotai'
import { langAtom, libAtom } from '../../atoms'
import { Tabs, Tab } from '@heroui/tabs'
import { useDisclosure } from '@heroui/react'
import { Input } from '@heroui/input'
import Form from '@/components/form'
import Link from "next/link"
import { getLanguageStrategy } from '@/lib/languages'
import { toast } from 'sonner'
import { scrapeArticle } from '@/server/ai/scrape'

/** Stable hash for seeding emoji background colors. */
function hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash + char) | 0
    }
    return Math.abs(hash)
}

/** Generates an extremely light Morandi-green background from article id. */
export function emojiBackground(id: string): string {
    const h = hashString(id)
    const hue = 130 + (h % 36)
    const chroma = 0.008 + (((h >> 8) % 10) / 10) * 0.012
    const lightness = 0.94 + (((h >> 16) % 10) / 10) * 0.04
    return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue})`
}

/** Picks a deterministic emoji from the article title. */
const ARTICLE_EMOJIS = ['📖', '🗂️', '🌍', '🎵', '📝', '🔀', '🤌', '🏛️', '🎧', '🎭', '📺', '💬', '✨', '🤝', '⚖️', '🧩', '📚', '🔎', '🧠', '🎯']
export function pickEmoji(id: string): string {
    return ARTICLE_EMOJIS[hashString(id) % ARTICLE_EMOJIS.length]!
}

/** Tag pill colors, matching mock UI. */
const tagColors = [
    'bg-default-100 text-default-500',
    'bg-default-50 text-default-400',
    'bg-default-200/50 text-default-500',
]

export function TagPills({ tags }: { tags: string[] }) {
    if (!tags.length) return null
    return (
        <div className='flex flex-wrap gap-1.5'>
            {tags.slice(0, 3).map((tag, i) => (
                <span
                    key={tag}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-wide ${tagColors[i % tagColors.length]}`}
                >
                    {tag}
                </span>
            ))}
        </div>
    )
}

/** Emoji cover in a rounded container with hash-seeded background. */
export function EmojiCover({ emoji, articleId, className = '' }: { emoji: string, articleId: string, className?: string }) {
    const bg = emojiBackground(articleId)
    return (
        <div
            className={`flex items-center justify-center ${className}`}
            style={{ backgroundColor: bg, containerType: 'size' }}
        >
            <span className='select-none leading-none' style={{ fontSize: 'min(35cqi, 35cqb)' }}>
                {emoji}
            </span>
        </div>
    )
}

/** Large article card with emoji above, title below. */
export function LeftCard({ id, title, topics, hasEbook }: {
    id: string, title: string, topics: string[], hasEbook: boolean
}) {
    const lib = useAtomValue(libAtom)
    const allTopics = hasEbook ? [...topics, '电子书'] : topics
    return (
        <Link href={`/library/${lib}/${id}`} className='group cursor-pointer block'>
            <EmojiCover
                emoji={pickEmoji(id)}
                articleId={id}
                className='mb-3 aspect-[4/3] w-full rounded-sm'
            />
            <h2 className='mb-2.5 font-formal text-[1.35rem] leading-snug tracking-tight text-foreground text-pretty group-hover:underline group-hover:decoration-default-300 group-hover:underline-offset-2'>
                {title}
            </h2>
            <TagPills tags={allTopics} />
        </Link>
    )
}

/** Center hero card — large emoji, centered title + optional subtitle. */
export function HeroCard({ id, title, topics, hasEbook }: {
    id: string, title: string, topics: string[], hasEbook: boolean
}) {
    const lib = useAtomValue(libAtom)
    const allTopics = hasEbook ? [...topics, '电子书'] : topics
    return (
        <Link href={`/library/${lib}/${id}`} className='group cursor-pointer block'>
            <EmojiCover
                emoji={pickEmoji(id)}
                articleId={id}
                className='mb-3 aspect-[4/3] w-full rounded-sm'
            />
            <h2 className='mb-3 text-center font-formal text-[2rem] leading-[1.2] tracking-tight text-foreground text-balance group-hover:underline group-hover:decoration-default-300 group-hover:underline-offset-2 sm:text-[2.4rem]'>
                {title}
            </h2>
            <div className='flex justify-center'>
                <TagPills tags={allTopics} />
            </div>
        </Link>
    )
}

/** Right-side compact card — title left, emoji right. */
export function RightCard({ id, title, topics, hasEbook }: {
    id: string, title: string, topics: string[], hasEbook: boolean
}) {
    const lib = useAtomValue(libAtom)
    const allTopics = hasEbook ? [...topics, '电子书'] : topics
    return (
        <Link href={`/library/${lib}/${id}`} className='group flex cursor-pointer gap-4'>
            <div className='flex min-w-0 flex-1 flex-col justify-center'>
                <h2 className='mb-2 font-formal text-[0.95rem] leading-snug tracking-tight text-foreground text-pretty group-hover:underline group-hover:decoration-default-300 group-hover:underline-offset-2'>
                    {title}
                </h2>
                <TagPills tags={allTopics} />
            </div>
            <EmojiCover
                emoji={pickEmoji(id)}
                articleId={id}
                className='h-[5.5rem] w-[5.5rem] flex-shrink-0 rounded-sm'
            />
        </Link>
    )
}

/** Compact card for additional articles below hero. */
export function CompactCard({ id, title, topics, hasEbook }: {
    id: string, title: string, topics: string[], hasEbook: boolean
}) {
    const lib = useAtomValue(libAtom)
    const allTopics = hasEbook ? [...topics, '电子书'] : topics
    return (
        <Link href={`/library/${lib}/${id}`} className='group flex cursor-pointer gap-3'>
            <div className='flex min-w-0 flex-1 flex-col justify-center'>
                <h3 className='mb-1.5 font-formal text-[0.9rem] leading-snug tracking-tight text-foreground text-pretty group-hover:underline group-hover:decoration-default-300 group-hover:underline-offset-2'>
                    {title}
                </h3>
                <TagPills tags={allTopics} />
            </div>
            <EmojiCover
                emoji={pickEmoji(id)}
                articleId={id}
                className='h-16 w-16 flex-shrink-0 rounded-sm'
            />
        </Link>
    )
}

/** 新建文章 add button — appears as a plus icon in grid or standalone button on mobile. */
export function AddTextButton({ variant = 'card' }: { variant?: 'card' | 'inline' }) {
    const lib = useAtomValue(libAtom)
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const { register, handleSubmit, setValue, formState } = useForm<{ url: string, title: string }>({
        defaultValues: { url: '', title: '' }
    })
    const lang = useAtomValue(langAtom)

    return <>
        {variant === 'inline' ? (
            <button
                type='button'
                onClick={onOpen}
                className='flex items-center gap-2 rounded-2xl bg-default-100 px-5 py-2.5 text-sm font-medium text-default-500 transition-colors hover:bg-default-200 hover:text-default-600'
            >
                <PiPlusBold className='h-4 w-4' />
                <span>新建文章</span>
            </button>
        ) : (
            <button
                type='button'
                onClick={onOpen}
                className='group flex aspect-[4/3] w-full cursor-pointer items-center justify-center rounded-sm transition-colors'
                style={{ backgroundColor: 'oklch(0.965 0.008 150)' }}
            >
                <PiPlusBold className='h-8 w-8 text-default-400 transition-transform group-hover:scale-110' />
            </button>
        )}
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

export default function Text({ id, title, topics, hasEbook, ...rest }: {
    id: string, title: string, topics: string[], hasEbook: boolean,
    createdAt?: string, disablePrefetch?: boolean, disableNavigation?: boolean,
    visitStatus?: 'loading' | 'visited' | 'not-visited',
}) {
    return <CompactCard id={id} title={title} topics={topics} hasEbook={hasEbook} />
}
