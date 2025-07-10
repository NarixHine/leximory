'use client'

import Comment from '@/components/comment'
import wrap from '@/lib/lang'
import MarkdownToJSX from 'markdown-to-jsx'
import MdImg from '../ui/mdimg'
import AudioPlayer from './audio'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { lexiconAtom } from '@/app/library/[lib]/[text]/atoms'
import { useAtomValue } from 'jotai'
import { contentFontFamily, jpFontFamily } from '@/lib/fonts'
import { CustomLexicon } from '@/lib/types'
import { langAtom } from '@/app/library/[lib]/atoms'
import { memo } from 'react'
import sanitize from 'sanitize-html'

export type MarkdownProps = {
    md: string,
    disableSave?: boolean
    deleteId?: string,
    lexicon?: CustomLexicon
    className?: string
    asCard?: boolean
    hasWrapped?: boolean
    onlyComments?: boolean
    print?: boolean
    shadow?: boolean
    fontFamily?: string
}

function Markdown({ md, deleteId, className, asCard, hasWrapped, disableSave, onlyComments, print, shadow, fontFamily }: MarkdownProps) {
    const lexicon = useAtomValue(lexiconAtom)
    const lang = useAtomValue(langAtom)

    const result = hasWrapped ? md.trim() : sanitize(wrap(md.trim(), lexicon))
        // space handling
        .replaceAll(' {{', '&nbsp;{{')
        .replaceAll('{{', '‎{{')
        .replaceAll('&gt;', '>')
        .replaceAll(/([*-]) \{\{/g, '$1  {{') // double space after list markers
        // fix erroneous wrapping
        .replaceAll('||}}', '}}')
        .replaceAll('|||', '||')
        .replaceAll(')} ', ')}} ')
        // prevent line breaks after comments by using word joiner (U+2060) before punctuation
        .replace(/}}( ?)([,.?!"”])/g, '}}⁠$2')
        // replace all instances of {{...}} with the Comment component
        .replace(/\{\{([^|}]+)(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?\}\}/g, (_, p1, p2, p3, p4, p5) => {
            const portions = [p1, p2, p3, p4, p5].filter(Boolean).map((portion) => encodeURIComponent((portion as string).replaceAll('\n', '').replaceAll('"', '\\"')))
            return '<Comment params={["' + portions.join('","') + '"]} disableSave={' + (disableSave ?? 'false') + '} deleteId={' + deleteId + '} asCard={' + ((onlyComments || asCard) ?? 'false') + '} onlyComments={' + (onlyComments ?? 'false') + '} print={' + (print ?? 'false') + '} shadow={' + (shadow ?? 'false') + '}></Comment>'
        })
        // replace all instances of :::...::: with the Audio component
        .replaceAll(/:::([A-Za-z0-9_-]+).*?\n(.*?):::/sg, (_, p1, p2) => {
            return `<Audio id="${p1}" md="${encodeURIComponent(p2)}" deleteId="${deleteId}"></Audio>`
        })

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
                p: (props) => (<div {...props} className='mb-5 last:mb-0' />),
                a: (props) => (<Link {...props} className='underline underline-offset-4' />),
                hr: () => (<div className='text-center text-2xl mt-5 mb-4'>﹡﹡﹡</div>),
            },
        }}
        style={{
            fontFamily: fontFamily ?? (lang === 'ja' ? jpFontFamily : contentFontFamily),
        }}
        className={cn(
            'prose dark:prose-invert prose-blockquote:not-italic prose-blockquote:border-default prose-blockquote:border-l-1.5 before:prose-code:content-["["] after:prose-code:content-["]"] prose-hr:my-8',
            className
        )}
    >{result}</MarkdownToJSX>)
}

export default memo(Markdown)
