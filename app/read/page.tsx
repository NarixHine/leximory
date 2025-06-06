import { getTexts } from '@/server/db/text'
import Link from 'next/link'
import { exampleSharedLib } from '@/lib/config'
import Main from '@/components/ui/main'
import H from '@/components/ui/h'
import Topics from '@/app/library/[lib]/[text]/components/topics'
import { contentFontFamily } from '@/lib/fonts'
import { Metadata } from 'next'
import { unstable_cacheLife as cacheLife } from 'next/cache'

export const metadata: Metadata = {
    title: exampleSharedLib.name,
}

export default async function ReadPage() {
    'use cache'
    cacheLife('days')

    const texts = await getTexts({ lib: exampleSharedLib.id })

    return (
        <Main className='container mx-auto py-16 px-4 max-w-3xl'>
            <H usePlayfair disableCenter className={'text-3xl mb-12 text-default-900'}>{exampleSharedLib.name}</H>
            <div className='space-y-8' style={{ fontFamily: contentFontFamily }}>
                {texts.map((text) => (
                    <Link prefetch href={`/read/${text.id}`} key={text.id} className='block'>
                        <h2 className='text-xl font-medium text-default-900 group-hover:text-default-600 transition-colors'>
                            {text.title}
                        </h2>
                        <Topics topics={text.topics} />
                    </Link>
                ))}
            </div>
        </Main>
    )
} 