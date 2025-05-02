import { Metadata } from 'next'
import { cn } from '@/lib/utils'
import { Spacer } from '@heroui/react'
import H from '@/components/ui/h'
import { CHINESE_ZCOOL, ENGLISH_SERIF } from '@/lib/fonts'
import Main from '@/components/ui/main'
import FixPaper from './components/fix-your-paper'
import Results from './components/results'
import Link from 'next/link'
import { Button } from '@heroui/button'
import { PiGithubLogo, PiInfo } from 'react-icons/pi'

export const metadata: Metadata = {
    title: 'Fix. Your. Paper.',
    description: '你的 AI 审题人'
}

export default function FixPaperPage() {
    return (<Main className='max-w-3xl flex flex-col items-center'>
        <Spacer y={10} className='hidden sm:block print:hidden' />

        <H usePlayfair>Fix. Your. Paper.</H>

        <Spacer y={3} />

        <p className={cn(ENGLISH_SERIF.className, 'text-center text-balance text-lg text-default-700')}>
            Quality papers are crafted with <span className='font-bold relative inline-block'>
                amiability
                <span className='absolute bottom-0 left-0 w-full h-1/2 bg-primary-200/40' />
            </span>. Not <span className='font-bold relative inline-block'>
                ambiguity
                <span className='absolute bottom-0 left-0 w-full h-1/2 bg-danger-200/40' />
            </span>.
        </p>

        <Spacer y={6} />

        <div className='space-y-6 w-full'>
            <FixPaper />
            <Results />
        </div>

        <Spacer y={6} />

        <footer className={cn(CHINESE_ZCOOL.className, 'text-center text-sm text-default-700 print:hidden')}>
            <div className='flex justify-center'>
                <span>每次审题消耗五<Link href='/library' className='underline'>额度</Link></span>
            </div>
            <div className='flex justify-center'>
               <Button
                    className='rounded-full text-lg text-default-700'
                    startContent={<PiGithubLogo />}
                    isIconOnly
                    size='sm'
                    as={Link}
                    variant='light'
                    href='https://github.com/NarixHine/leximory/tree/main/app/fix-your-paper'
                ></Button>
                <Button
                    className='rounded-full text-lg text-default-700'
                    startContent={<PiInfo />}
                    isIconOnly
                    size='sm'
                    as={Link}
                    variant='light'
                    href='https://hello.leximory.com/blog/fix-your-paper'
                ></Button>
            </div>
        </footer>
    </Main>)
} 