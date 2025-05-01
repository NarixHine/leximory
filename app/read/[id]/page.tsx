import { getTextContent } from '@/server/db/text'
import { postFontFamily } from '@/lib/fonts'
import Markdown from '@/components/markdown'
import Main from '@/components/ui/main'
import H from '@/components/ui/h'
import Topics from '@/app/library/[lib]/[text]/components/topics'
import { Button, ButtonProps } from '@heroui/button'
import Link from 'next/link'
import { PiArrowLeftDuotone } from 'react-icons/pi'
import { Spacer } from '@heroui/spacer'

function ReturnButton({ ...props }: ButtonProps) {
    return (
        <Button as={Link} href='/read' startContent={<PiArrowLeftDuotone />} variant='light' {...props}>
            Back to articles
        </Button>
    )
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const { content, title, topics } = await getTextContent({ id })

    return (
        <Main className='container mx-auto py-16 px-4 max-w-4xl'>
            <ReturnButton className='text-sm mb-8 opacity-80 underline underline-offset-4 font-mono' />
            <H className='text-4xl font-bold mb-2 text-default-900 tracking-tight'>{title}</H>
            <Topics topics={topics} className='mb-6 flex justify-center' />
            <Markdown
                fontFamily={postFontFamily}
                className={'max-w-[650px] mx-auto block px-4 sm:px-0 !prose-lg text-pretty'}
                md={`<article>\n${content}\n\n</article>`}
            />
            <Spacer y={3} />
            <ReturnButton fullWidth size='lg' className='mx-auto underline underline-offset-4 font-mono' />
        </Main>
    )
}
