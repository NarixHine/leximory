import { LibProps } from '@/lib/types'
import Markdown from '@/components/markdown'
import { getAllWordsInLib } from '@/server/db/word'
import ReaderToggle from './reader-toggle'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: '语料汇总'
}

const getData = async (lib: string) => {
    const words = await getAllWordsInLib({ lib })
    return words
}

export default async function PrintPage({ params }: LibProps) {
    const { lib } = await params
    const words = await getData(lib)

    return (
        <div className='p-8 print:p-0'>
            <div className='mb-6'>
                <h1 className='font-formal text-2xl tracking-tight text-foreground'>语料汇总</h1>
                <div className='flex items-center gap-2 print:hidden pt-2 text-default-400 text-sm'>
                    <ReaderToggle />
                    <span>按 Ctrl + P 打印词卡</span>
                </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
                <div className='col-span-1'>
                    {words.filter((_, index) => index % 2 === 0).map(({ word, id }) => (
                        <Markdown key={id} md={word} print />
                    ))}
                </div>
                <div className='col-span-1'>
                    {words.filter((_, index) => index % 2 === 1).map(({ word, id }) => (
                        <Markdown key={id} md={word} print />
                    ))}
                </div>
            </div>
        </div>
    )
} 
