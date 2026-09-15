'use client'

import { Button } from '@heroui/button'
import { useAtom } from 'jotai'
import { useState, useTransition } from 'react'
import { PiBookmarkSimple, PiCursorClick, PiLockSimple, PiTrash } from 'react-icons/pi'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { bookmarksAtom } from '../../atoms'
import { removeBookmarkAction } from '@/service/bookmark'

/**
 * The reader's private bookmarks for the current text. Rendered with the same
 * prose and blockquote treatment as the article body so saved quotes read as
 * part of the text rather than as a separate widget.
 */
export default function Bookmarks() {
    const [bookmarks, setBookmarks] = useAtom(bookmarksAtom)
    const [removing, startRemoving] = useTransition()
    const [pendingId, setPendingId] = useState<number | null>(null)

    const handleRemove = (id: number) => {
        setPendingId(id)
        startRemoving(async () => {
            const previous = bookmarks
            setBookmarks(current => current.filter(bookmark => bookmark.id !== id))
            try {
                await removeBookmarkAction(id)
            } catch {
                setBookmarks(previous)
                toast.error('删除文摘失败，请重试')
            } finally {
                setPendingId(null)
            }
        })
    }

    return (
        <section className='mx-auto mt-14 max-w-160 px-4 sm:px-0'>
            <header className='mb-5 flex items-center gap-2.5 border-b border-default-200 pb-3'>
                <span className='flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-500 dark:bg-primary-500/15 dark:text-primary-300'>
                    <PiBookmarkSimple className='size-4' />
                </span>
                <h2 className='font-fancy text-lg font-semibold text-foreground'>文摘</h2>
                <span className='ml-auto flex items-center gap-1.5 text-base text-default-500'>
                    <PiLockSimple className='size-4' />
                    仅你可见
                </span>
            </header>
            {bookmarks.length === 0 ? (
                <p className='flex items-center gap-2 font-formal text-default-500'>
                    <PiCursorClick className='size-4 shrink-0 text-default-400' />
                    长按选中文字即可添加文摘。
                </p>
            ) : (
                <div
                    className={cn(
                        'dark:prose-invert prose prose-lg font-formal',
                        'prose-blockquote:not-italic prose-blockquote:border-default! prose-blockquote:border-l-2! prose-blockquote:text-foreground',
                        'prose-blockquote:my-6 prose-blockquote:pl-5',
                        // Tailwind Typography decorates blockquotes with opening and
                        // closing quote marks; saved excerpts are verbatim text, so drop them.
                        '[&_blockquote_p:first-of-type]:before:content-none! [&_blockquote_p:last-of-type]:after:content-none!',
                    )}
                >
                    {bookmarks.map(bookmark => (
                        <blockquote key={bookmark.id}>
                            <p className='whitespace-pre-wrap'>{bookmark.quote}</p>
                            <footer className='mt-2 flex items-center justify-between gap-3 text-base not-italic'>
                                <span className='font-mono'>{bookmark.chapter ?? ''}</span>
                                <Button
                                    isIconOnly
                                    size='sm'
                                    radius='full'
                                    variant='light'
                                    color='danger'
                                    aria-label='删除文摘'
                                    isDisabled={removing}
                                    isLoading={pendingId === bookmark.id}
                                    startContent={
                                        pendingId === bookmark.id ? undefined : (
                                            <PiTrash className='size-4' />
                                        )
                                    }
                                    onPress={() => handleRemove(bookmark.id)}
                                />
                            </footer>
                        </blockquote>
                    ))}
                </div>
            )}
        </section>
    )
}
