'use client'

import Comment from '@/components/comment'
import lexiconWrap from '@/lib/comment'
import { commentSyntaxRegex } from '@repo/utils'
import MarkdownToJSX, { RuleType } from 'markdown-to-jsx'
import MdImg from '../ui/mdimg'
import Audio from './audio'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { lexiconAtom } from '@/app/library/[lib]/[text]/atoms'
import { useAtomValue } from 'jotai'
import { CustomLexicon } from '@/lib/types'
import { memo } from 'react'
import sanitize from 'sanitize-html'
import Equation from './equation'
import { langAtom } from '@/app/library/[lib]/atoms'
import { getLanguageStrategy } from '@/lib/languages/strategies'

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
    compact?: boolean
    inlineMode?: boolean
}

function Markdown({ md, deleteId, className, asCard, hasWrapped, disableSave, onlyComments, print, compact, inlineMode }: MarkdownProps) {
    const lexicon = useAtomValue(lexiconAtom)
    const lang = useAtomValue(langAtom)

    const sanitizedMd = hasWrapped ? md.trim() : sanitize(lexiconWrap(md.trim(), lexicon))

    const result = (lang === 'en' ? sanitizedMd.replaceAll('}}，', '}}, ') : sanitizedMd)
        // double space after list markers
        .replace(/([*-]) \{\{/g, '$1  {{')
        // space handling
        .replaceAll(' {{', '&nbsp;{{')
        .replaceAll('&gt;', '>')
        // fix erroneous wrapping
        .replaceAll(/\|+}}/g, '}}') // remove trailing pipes
        .replaceAll('|||', '||')
        .replaceAll(')} ', ')}} ')
        .replaceAll(/\s+([.,!?;:"。，！？；：、”])/g, '$1') // remove intervening space if followed by punctuation
        // replace all instances of {{...}} with the Comment component
        .replace(commentSyntaxRegex, (_, p1: string, p2: string, p3: string, p4: string, p5: string) => {
            const portions = [p1, p2, lang === 'ja' ? p3.replace('）**', '）** ') : p3, p4, p5].filter(Boolean).map((portion) => encodeURIComponent((portion as string).replaceAll('\n', '').replaceAll('"', '\\"')))

            return '<Comment params={["' + portions.join('","') + '"]} disableSave={' + (disableSave ?? 'false') + '} deleteId={' + deleteId + '} asCard={' + ((onlyComments || asCard) ?? 'false') + '} onlyComments={' + (onlyComments ?? 'false') + '} print={' + (print ?? 'false') + '} inlineMode={' + (inlineMode ?? 'false') + '}></Comment>'
        })
        // prevent line break after comments
        .replace(/(<Comment[^>]*><\/Comment>)(\s?)([.,!?;:"。，！？；：、”])/g, '<Nobr>$1<span>$3</span></Nobr>')
        // prevent comments at start of line from being treated as block elements
        .replace(/^(<Comment|<Nobr)/gm, '\u200B$1')
        // replace all instances of :::...::: with the Audio component
        .replace(/:::([A-Za-z0-9_-]+).*?\n(.*?):::/sg, (_, p1, p2) => {
            return `<Audio id="${p1}" md="${encodeURIComponent(p2)}" deleteId="${deleteId}"></Audio>`
        })
        // replace all instances of &&...&& with <span class="smallcaps">
        .replace(/&amp;&amp;(.+?)&amp;&amp;/g, (_, p1) => {
            return `<span class="smallcaps">${p1}</span>`
        })

    const strategy = getLanguageStrategy(lang)

    // After stripping the <article> wrapper and any leading zero-width/nbsp chars,
    // the first paragraph starts with a dropcap-eligible letter only when it begins
    // with plain text rather than a <Comment> / <Nobr> / <Audio> tag.
    const firstParaDropcap = strategy.isDropcapEnabled && (
        /^\p{L}/u.test(
            result.replace(/^<article>\n?/, '').replace(/^[\u200B\u200E\u200F\u00A0]+/, '').trimStart()
        ) || /^<span class="smallcaps">/i.test(
            result.replace(/^<article>\n?/, '').replace(/^[\u200B\u200E\u200F\u00A0]+/, '').trimStart()
        )
    )

    return (
        <div
            className={cn(
                'dark:prose-invert prose',
                'prose-blockquote:not-italic prose-blockquote:border-default! prose-blockquote:border-l-2! prose-blockquote:text-foreground',
                'prose-hr:my-8',
                'prose-em:font-light',
                '[&_pre_code]:before:content-none [&_pre_code]:after:content-none',
                'prose-headings:font-fancy',
                'font-formal',
                firstParaDropcap && 'has-dropcap-first',
                className
            )}
        >
            <MarkdownToJSX
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
                        p: (props) => <div {...props} className={cn('last:mb-0', compact ? 'mb-2' : 'mb-5')} />,
                        a: (props) => (<Link {...props} className='underline underline-offset-4' />),
                        hr: () => (<div className={cn('text-2xl text-center', compact ? 'mb-2 mt-3' : 'mb-4 mt-5')}>﹡﹡﹡</div>),
                    },
                    renderRule(next, node, _, state) {
                        if (node.type === RuleType.codeBlock && node.lang === 'latex') {
                            return <Equation text={node.text} key={state.key} />
                        }
                        return next()
                    }
                }}
            >
                {result}
            </MarkdownToJSX>
        </div>
    )
}

export default memo(Markdown)
