'use client'

import { useAtom } from 'jotai'
import { Accordion, AccordionItem, Spacer, Spinner } from '@heroui/react'
import H from '@/components/ui/h'
import { postFontFamily } from '@/lib/fonts'
import Markdown from '@/components/markdown'
import { resultAtom, paperAnalysisAtom, isLoadingAtom } from '../atoms'
import { PiChatTeardropDots, PiFlask, PiQuestion } from 'react-icons/pi'

export default function Results() {
    const [result] = useAtom(resultAtom)
    const [paperAnalysis] = useAtom(paperAnalysisAtom)
    const [isLoading] = useAtom(isLoadingAtom)
    return (
        <>
            <Spacer y={8} />

            <Accordion className='w-full max-w-none gap-6' defaultExpandedKeys={['review-report']}>
                <AccordionItem
                    key='ai-answer'
                    startContent={isLoading && !paperAnalysis ? <Spinner variant='gradient' color='default' /> : <PiFlask className='text-2xl ml-2' />}
                    title={<H usePlayfair disableCenter className='text-lg'>初步作答</H>}
                    subtitle='For reference only. No need to acknowledge everything AI says.'
                >
                    <Markdown fontFamily={postFontFamily} md={paperAnalysis ?? '<article>\n> 未生成\n</article>'} />
                </AccordionItem>

                <AccordionItem
                    key='review-report'
                    startContent={isLoading && !result ? <Spinner variant='gradient' color='default' /> : <PiChatTeardropDots className='text-2xl ml-2' />}
                    title={<H usePlayfair disableCenter className='text-lg'>审题报告</H>}
                    subtitle='A third-party opinion from which to pick what sounds reasonable to you.'
                >
                    <div className='max-w-none'>
                        <Markdown fontFamily={postFontFamily} md={result ?? '<article>\n> 未生成\n</article>'} />
                    </div>
                </AccordionItem>

                <AccordionItem startContent={<PiQuestion />} key='ai-role' title={<H usePlayfair disableCenter className='text-medium'>为什么 AI 是你的最好审题人</H>} subtitle='AI is your impartial, independent, native-level ESL exam paper reviewer.'>
                    <div style={{ fontFamily: postFontFamily }} className='prose prose-sm max-w-none'>
                        <p>It helps you spot <span className='italic'>the grammatically possible but contextually impossible</span>, or <span className='italic'>the contextually suitable but pragmatically unnatural</span>, or questions subject to multiple interpretations. It evaluates the linguistic appropriateness of exam content with native-like intuition and analytical precision.</p>

                        <p>For example, AI can flag questions that are technically correct in grammar but misleading in real-world use. It also identifies awkward phrasing, idiomatic misuse, and vague prompts that allow multiple valid answers—issues that undermine the fairness and clarity of an exam.</p>

                        <p>By offering objective, language-informed feedback, AI ensures that every question measures true language ability rather than a test-taker&apos;s ability to guess what the examiner meant.</p>
                    </div>
                </AccordionItem>
            </Accordion>
        </>
    )
} 