import { Metadata } from 'next'
import { cn } from '@/lib/utils'
import { Spacer } from '@heroui/spacer'
import H from '@/components/ui/h'
import { ENGLISH_SERIF } from '@/lib/fonts'
import Main from '@/components/ui/main'
import FixPaper from './components/fix-your-paper'
import Results from './components/results'
import Link from 'next/link'
import { Button } from '@heroui/button'
import { PiGithubLogo, PiInfo } from 'react-icons/pi'
import Privacy from './components/privacy'
import { fixYourPaperGitHubLink, fixYourPaperBlogLink } from '@/lib/config'

export const metadata: Metadata = {
    title: 'Fix. Your. Paper.',
    description: '你的 AI 审题人'
}

export default function FixPaperPage() {
    return (<Main className='max-w-3xl flex flex-col items-center'>
        <H fancy>Fix. Your. Paper.</H>

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

        <Spacer y={10} />

        <footer className={cn('text-center text-sm text-default-700 print:hidden')}>
            <div className='flex justify-center'>
                <span>每次审题消耗五<Link href='/library' className='underline'>额度</Link></span>
            </div>
            <Spacer y={0.5} />
            <div className='flex justify-center'>
                <Button
                    className='rounded-full text-lg text-default-700'
                    startContent={<PiGithubLogo />}
                    isIconOnly
                    size='sm'
                    as={Link}
                    target='_blank'
                    variant='light'
                    href={fixYourPaperGitHubLink}
                ></Button>
                <Button
                    className='rounded-full text-lg text-default-700'
                    startContent={<PiInfo />}
                    isIconOnly
                    size='sm'
                    as={Link}
                    target='_blank'
                    variant='light'
                    href={fixYourPaperBlogLink}
                ></Button>
                <Privacy />
            </div>
        </footer>
    </Main>)
} 