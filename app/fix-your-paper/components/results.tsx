'use client'

import { useAtom } from 'jotai'
import { Accordion, AccordionItem, Spacer, Spinner } from '@heroui/react'
import H from '@/components/ui/h'
import { postFontFamily } from '@/lib/fonts'
import Markdown from '@/components/markdown'
import { resultAtom, paperAnalysisAtom, isLoadingAtom } from '../atoms'
import { PiChatTeardropDots, PiFlask, PiQuestion } from 'react-icons/pi'
import { HydrationBoundary } from 'jotai-ssr'
import { lexiconAtom } from '@/app/library/[lib]/[text]/atoms'
import { useEffect, useState } from 'react'

export default function Results() {
    const [result] = useAtom(resultAtom)
    const [paperAnalysis] = useAtom(paperAnalysisAtom)
    const [isLoading] = useAtom(isLoadingAtom)
    
    const [expandedKeys, setExpandedKeys] = useState(new Set(['ai-answer']))

    useEffect(() => {
        switch (true) {
            case isLoading && paperAnalysis !== '' && result === '':
                setExpandedKeys(new Set(['ai-answer']))
                break
            case result !== '':
                setExpandedKeys(new Set(['review-report']))
                break
            default:
                setExpandedKeys(new Set(['ai-answer']))
        }
    }, [isLoading, paperAnalysis, result])

    return (
        <HydrationBoundary hydrateAtoms={[[lexiconAtom, 'none']]}>
            <Spacer y={8} />

            <Accordion 
                className='w-full max-w-none gap-6' 
                selectedKeys={expandedKeys}
                onSelectionChange={setExpandedKeys as any}
            >
                <AccordionItem
                    key='ai-answer'
                    startContent={isLoading && !paperAnalysis ? <Spinner variant='gradient' color='default' /> : <PiFlask className='text-2xl ml-2' />}
                    title={<H usePlayfair disableCenter className='text-lg'>初步作答</H>}
                    subtitle='For reference only. No need to acknowledge everything AI says.'
                >
                    <Markdown fontFamily={postFontFamily} md={paperAnalysis === '' ? '<article>\n> 未生成\n</article>' : paperAnalysis} />
                </AccordionItem>

                <AccordionItem
                    key='review-report'
                    startContent={isLoading && !result ? <Spinner variant='gradient' color='default' /> : <PiChatTeardropDots className='text-2xl ml-2' />}
                    title={<H usePlayfair disableCenter className='text-lg'>审题报告</H>}
                    subtitle='A third-party opinion, from which to pick what&apos;s reasonable.'
                >
                    <div className='max-w-none'>
                        <Markdown fontFamily={postFontFamily} md={result === '' ? '<article>\n> 未生成\n</article>' : result} />
                    </div>
                </AccordionItem>

                <AccordionItem
                    startContent={<PiQuestion />}
                    key='ai-role'
                    title={<H usePlayfair disableCenter className='text-medium'>为什么 AI 是你的最佳审题人？</H>}
                    subtitle='Independent. Impartial. Instant. Incomparable in language proficiency.'
                >
                    <div style={{ fontFamily: postFontFamily }} className='prose prose-sm dark:prose-invert max-w-none'>
                        <p>Artificial Intelligence is like a <span className='italic'>brutally objective native speaker</span>, who helps you spot questions subject to multiple interpretations. It evaluates the linguistic appropriateness of exam content with native-like intuition and analytical precision.</p>

                        <p>For example, AI can flag questions that are technically correct in grammar but misleading in real-world use. It also identifies awkward phrasing, idiomatic misuse, and vague prompts that allow multiple valid answers—issues that undermine the fairness and clarity of an exam.</p>

                        <p>By offering objective, language-informed feedback, AI ensures that every question measures true language ability rather than a test-taker&apos;s ability to guess what the examiner meant.</p>
                    </div>
                </AccordionItem>
            </Accordion>
        </HydrationBoundary>
    )
} 