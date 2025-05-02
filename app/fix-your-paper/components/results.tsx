'use client'

import { useAtom } from 'jotai'
import { Accordion, AccordionItem, Spacer } from '@heroui/react'
import H from '@/components/ui/h'
import { postFontFamily } from '@/lib/fonts'
import Markdown from '@/components/markdown'
import { resultAtom, paperAnalysisAtom } from '../atoms'
import { PiQuestion } from 'react-icons/pi'

export default function Results() {
    const [result] = useAtom(resultAtom)
    const [paperAnalysis] = useAtom(paperAnalysisAtom)

    return (
        <>
            <Spacer y={8} />

            <Accordion className='w-full max-w-none gap-6' defaultExpandedKeys={['review-report']}>
                <AccordionItem key='ai-answer' title={<H usePlayfair disableCenter className='text-2xl'>AI作答</H>}>
                    <Markdown fontFamily={postFontFamily} md={paperAnalysis ?? '<article>\n> 未生成\n</article>'} />
                </AccordionItem>

                <AccordionItem key='review-report' title={<H usePlayfair disableCenter className='text-2xl'>审题报告</H>}>
                    <div className='max-w-none'>
                        <Markdown fontFamily={postFontFamily} md={result ?? '<article>\n> 未生成\n</article>'} />
                    </div>
                </AccordionItem>

                <AccordionItem startContent={<PiQuestion />} key='ai-role' title={<H usePlayfair disableCenter className='text-lg'>为什么 AI 是你的最好审题人</H>} subtitle='AI is your impartial, independent, native-level ESL exam paper reviewer.'>
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