'use client'

import Comment from '@/components/comment'
import wrap from '@/lib/lang'
import MarkdownToJSX from 'markdown-to-jsx'
import MdImg from './mdimg'
import AudioPlayer from './audio'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { lexiconAtom } from '@/app/library/[lib]/[text]/atoms'
import { useAtomValue } from 'jotai'
import { defaultFontFamily } from '@/lib/fonts'

export type MarkdownProps = {
    md: string,
    disableSave?: boolean
    deleteId?: string,
    lexicon?: CustomLexicon
    className?: string
    asCard?: boolean
    hasWrapped?: boolean
}

export default function Markdown({ md, deleteId, className, asCard, hasWrapped, disableSave }: MarkdownProps) {
    const lexicon = useAtomValue(lexiconAtom)
    const result = (hasWrapped ? md.trim() : wrap(md.trim(), lexicon))
        .replaceAll('}} ,', '}},')
        .replaceAll('}} .', '}}.')
        .replace(/\{\{([^|}]+)(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?\}\}/g, (_, p1, p2, p3, p4, p5) => {
            const portions = [p1, p2, p3, p4, p5].filter(Boolean).map((portion) => portion.replaceAll('"', '\\"'))
            return '<Comment params={["' + portions.join('","') + '"]} disableSave={' + (disableSave ?? 'false') + '} deleteId={' + deleteId + '} asCard={' + (asCard ?? 'false') + '}></Comment>'
        })
        .replaceAll(/:::([a-f0-9-]+).*?\n(.*?):::/sg, (_, p1, p2) => {
            return `<Audio id="${p1}" md="${encodeURIComponent(p2)}" deleteId="${deleteId}"></Audio>`
        })
        .replaceAll(' <Comment', '&nbsp;<Comment')
        .replaceAll('<Comment', '‎<Comment')
        .replaceAll('&gt;', '>')
    return (<MarkdownToJSX
        options={{
            overrides: {
                Comment: {
                    component: Comment,
                },
                Audio: {
                    component: AudioPlayer
                },
                img: ({ alt, ...props }) => (<MdImg alt={alt ?? 'Image'} {...props} />),
                p: (props) => (<div {...props} className='mb-5' />),
                a: (props) => (<Link {...props} className='underline underline-offset-4' />),
            },
        }}
        style={{
            fontFamily: defaultFontFamily,
        }}
        className={cn('prose dark:prose-invert prose-blockquote:not-italic prose-blockquote:border-danger prose-blockquote:border-l-1.5 before:prose-code:content-["["] after:prose-code:content-["]"]', className)}
    >{result}</MarkdownToJSX>)
}
