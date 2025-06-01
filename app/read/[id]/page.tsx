import { getTextContent } from '@/server/db/text'
import { contentFontFamily } from '@/lib/fonts'
import Markdown from '@/components/markdown'
import Main from '@/components/ui/main'
import H from '@/components/ui/h'
import Topics from '@/app/library/[lib]/[text]/components/topics'
import { Button, ButtonProps } from '@heroui/button'
import Link from 'next/link'
import { PiArrowLeftDuotone } from 'react-icons/pi'
import { Spacer } from '@heroui/spacer'
import { exampleSharedLib } from '@/lib/config'
import { notFound } from 'next/navigation'
import { unstable_cacheLife as cacheLife } from 'next/cache'

type ArticlePageProps = {
    params: Promise<{ id: string }>
}

const getData = async (id: string) => {
    const { content, title, topics, lib } = await getTextContent({ id })
    if (lib.id === exampleSharedLib.id) {
        return {
            title,
            content,
            topics
        }
    }
    else {
        notFound()
    }
}

export async function generateMetadata({ params }: ArticlePageProps) {
    const { id } = await params
    const { title } = await getData(id)
    return {
        title
    }
}

function ReturnButton({ ...props }: ButtonProps) {
    return (
        <Button as={Link} href='/read' startContent={<PiArrowLeftDuotone />} variant='light' {...props}>
            Back to articles
        </Button>
    )
}

export default async function ArticlePage({ params }: ArticlePageProps) {
    'use cache'
    cacheLife('days')

    const { id } = await params
    const { title, topics, content } = await getData(id)

    return (
        <Main className='container mx-auto py-16 px-4 max-w-4xl'>
            <ReturnButton className='text-sm mb-8 opacity-80 underline underline-offset-4 font-mono' />
            <H className='text-4xl font-bold mb-2 text-default-900 tracking-tight'>{title}</H>
            <Topics topics={topics} className='mb-6 flex justify-center' />
            <Markdown
                fontFamily={contentFontFamily}
                className={'max-w-[650px] mx-auto block px-4 sm:px-0 !prose-lg text-pretty'}
                md={`<article>\n${content}\n\n</article>`}
            />
            <Spacer y={3} />
            <ReturnButton fullWidth size='lg' className='mx-auto underline underline-offset-4 font-mono' />
        </Main>
    )
}
