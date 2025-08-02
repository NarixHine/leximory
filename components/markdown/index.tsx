'use client'

import Comment from '@/components/comment'
import wrap, { commentSyntaxRegex } from '@/lib/comment'
import MarkdownToJSX, { RuleType } from 'markdown-to-jsx'
import MdImg from '../ui/mdimg'
import Audio from './audio'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { lexiconAtom } from '@/app/library/[lib]/[text]/atoms'
import { useAtomValue } from 'jotai'
import { CustomLexicon } from '@/lib/types'
import { langAtom } from '@/app/library/[lib]/atoms'
import { memo } from 'react'
import sanitize from 'sanitize-html'
import Equation from './equation'

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
    commentClassName?: string
}

function Markdown({ md, deleteId, className, asCard, hasWrapped, disableSave, onlyComments, print }: MarkdownProps) {
    const lexicon = useAtomValue(lexiconAtom)
    const lang = useAtomValue(langAtom)

    const result = hasWrapped ? md.trim() : sanitize(wrap(md.trim(), lexicon))
        // double space after list markers
        .replace(/([*-]) \{\{/g, '$1  {{')
        // space handling
        .replaceAll(' {{', '&nbsp;{{')
        .replaceAll('{{', '‎{{')
        .replaceAll('&gt;', '>')
        // fix erroneous wrapping
        .replaceAll(/\|+}}/g, '}}') // remove trailing pipes
        .replaceAll('|||', '||')
        .replaceAll(')} ', ')}} ')
        // replace all instances of {{...}} with the Comment component
        .replace(commentSyntaxRegex, (_, p1, p2, p3, p4, p5) => {
            const portions = [p1, p2, p3, p4, p5].filter(Boolean).map((portion) => encodeURIComponent((portion as string).replaceAll('\n', '').replaceAll('"', '\\"')))
            return '<Comment params={["' + portions.join('","') + '"]} disableSave={' + (disableSave ?? 'false') + '} deleteId={' + deleteId + '} asCard={' + ((onlyComments || asCard) ?? 'false') + '} onlyComments={' + (onlyComments ?? 'false') + '} print={' + (print ?? 'false') + '}></Comment>'
        })
        // prevent line break after comments
        .replace(/(<Comment[^>]*><\/Comment>)(\s?)([.,!?:"。，！？：、”])/g, '<Nobr>$1<span>$3</span></Nobr>')
        // replace all instances of :::...::: with the Audio component
        .replace(/:::([A-Za-z0-9_-]+).*?\n(.*?):::/sg, (_, p1, p2) => {
            return `<Audio id="${p1}" md="${encodeURIComponent(p2)}" deleteId="${deleteId}"></Audio>`
        })

    return (<MarkdownToJSX
        options={{
            overrides: {
                Comment: {
                    component: Comment,
                },
                Audio: {
                    component: Audio
                },
                Nobr: {
                    component: ({ children }) => <span className='whitespace-nowrap'>{children}</span>,
                },
                img: ({ alt, ...props }) => (<MdImg alt={alt ?? 'Image'} {...props} />),
                p: (props) => (<div {...props} className='mb-5 last:mb-0' />),
                a: (props) => (<Link {...props} className='underline underline-offset-4' />),
                hr: () => (<div className='text-center text-2xl mt-5 mb-4'>﹡﹡﹡</div>),
            },
            renderRule(next, node, _, state) {
                if (node.type === RuleType.codeBlock && node.lang === 'latex') {
                    return <Equation text={node.text} key={state.key} />
                }
                return next()
            }
        }}
        className={cn(
            'prose dark:prose-invert prose-blockquote:not-italic prose-blockquote:border-default prose-blockquote:border-l-1.5 prose-hr:my-8 prose-em:font-light prose-code:before:content-["["] prose-code:after:content-["]"] prose-code:font-medium',
            lang === 'ja' ? 'font-ja' : 'font-formal',
            className
        )}
    >{result}</MarkdownToJSX>)
}

export default memo(Markdown)
