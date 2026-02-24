import H from '@/components/ui/h'
import { Spacer } from "@heroui/spacer"
import Center from '@/components/ui/center'
import type { Metadata } from 'next'
import { postsData } from './posts'
import { luxon } from '@/lib/luxon'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'The Leximory Blog',
    description: 'The tech and mind behind Leximory.',
}

export default function BlogHome() {
    return <Center>
        <div className='flex flex-col items-center justify-center sm:flex-row my-3'>
            <Link href={'/'} className='border-l-2 border-l-primary-800/50 px-3 py-1'>
                <H disableCenter className={'text-primary-800 text-4xl pb-2 font-semibold'} fancy>
                    <span className='opacity-30'>The</span> <span className='mx-1'>Leximory</span> <span className='opacity-30'>Blog</span>
                </H>
                <H disableCenter className={'text-primary-800/80 text-lg leading-tight'}>
                    The tech and mind behind Leximory.
                </H>
            </Link>
            <Spacer y={5}></Spacer>
            <div className='space-y-3 flex flex-wrap justify-center'>
                {postsData.map((post, i) => <span key={i} className='border-primary/10 px-3 not-prose inline-block'>
                    <Link href={`/blog/${post.slug}`}>
                        <H disableCenter className={'text-xl font-fancy!'}>
                            {post.title}
                        </H>
                    </Link>
                    <H disableCenter className={'text-sm -my-0.5 text-default-400 font-mono!'}>
                        {luxon(new Date(post.date)).toFormat('MMM dd, yyyy')}
                    </H>
                </span>)}
            </div>
        </div>
    </Center>
}
