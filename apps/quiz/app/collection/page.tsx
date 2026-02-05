import { Main } from '@repo/ui/main'
import { getAllNotesAction } from '@repo/service/question-note'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { Progress } from '@heroui/progress'
import { NotebookList } from './components/question-notebook-list'
import { NotebookIcon } from '@phosphor-icons/react/ssr'

export const metadata: Metadata = {
    title: '笔记本',
}

export default function Page() {
    return (
        <Main>
            <div className='mb-6 mt-4 grid grid-cols-[auto_1fr] gap-x-1'>
                <NotebookIcon size={60} weight='thin' className='text-default-foreground row-span-2' />
                <h1 className='text-3xl font-bold'>笔记本</h1>
                <p className='text-default-500'>收录的笔记（错题与表达）</p>
            </div>
            <section className='grid grid-cols-1 md:grid-cols-2 gap-5'>
                <Suspense fallback={<Progress isIndeterminate />}>
                    <Content />
                </Suspense>
            </section>
        </Main>
    )
}

async function Content() {
    const { data } = await getAllNotesAction({})
    return <NotebookList initialData={data} />
}
