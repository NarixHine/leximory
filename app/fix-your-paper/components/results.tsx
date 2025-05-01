'use client'

import { useAtom } from 'jotai'
import { Spacer } from '@heroui/react'
import H from '@/components/ui/h'
import { postFontFamily } from '@/lib/fonts'
import Markdown from '@/components/markdown'
import { resultAtom, paperAnalysisAtom } from '../atoms'

export default function Results() {
    const [result] = useAtom(resultAtom)
    const [paperAnalysis] = useAtom(paperAnalysisAtom)

    return (
        <>
            <Spacer y={8} />

            <div>
                <H usePlayfair disableCenter className='mb-4 text-2xl'>AI作答</H>
                <div className='max-w-none'>
                    <Markdown fontFamily={postFontFamily} md={paperAnalysis ?? '<article>\n> 未生成\n</article>'} />
                </div>
            </div>

            <Spacer y={6} />

            <div>
                <H usePlayfair disableCenter className='mb-4 text-2xl'>审题报告</H>
                <div className='max-w-none'>
                    <Markdown fontFamily={postFontFamily} md={result ?? '<article>\n> 未生成\n</article>'} />
                </div>
            </div>
        </>
    )
} 