import { hFontFamily, ENGLISH_PLAYFAIR } from '@/lib/fonts'
import H from '@/components/h'
import Main from '@/components/main'
import { Spacer } from '@nextui-org/react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function BlogHome() {
    const posts = [
        { title: 'The Inspiration, Creation and Mission of Leximory', date: '2024-07-20', slug: 'summer-hackathon' },
        { title: '“边听边阅览”功能导引', date: '2024-07-18', slug: 'reading-while-listening' },
        { title: '从记忆到心会', date: '2024-07-15', slug: 'from-memorisation-to-acquisition' }
    ]
    return <Main>
        <div className='border-l-2 border-l-danger/50 px-3 not-prose'>
            <H disableCenter className={cn('text-danger text-4xl', ENGLISH_PLAYFAIR.className)}>
                The Leximory Blog
            </H>
            <H disableCenter useSerif className={'text-danger/80 text-lg'}>
                The tech and mind behind Leximory.
            </H>
        </div>
        <Spacer y={5}></Spacer>
        <div className='space-y-3'>
            {posts.map((post, i) => <div key={i} className='border-danger/10 px-3 not-prose' style={{
                fontFamily: hFontFamily,
            }}>
                <Link href={`/blog/${post.slug}`}>
                    <H disableCenter className={'text-xl'}>
                        {post.title}
                    </H>
                </Link>
                <H disableCenter className={'text-danger/80 text-sm -my-0.5'}>
                    {new Date(post.date).toDateString()}
                </H>
            </div>)}
        </div>
    </Main>
}
