import { Main } from '@repo/ui/main'
import { getRecentQuestionNotesAction } from '@repo/service/question-note'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { Progress } from '@heroui/progress'
import { QuestionNotebookList } from './components/question-notebook-list'
import { NotebookIcon } from '@phosphor-icons/react/ssr'

export const metadata: Metadata = {
    title: '错题本',
}

export default function Page() {
    return (
        <Main>
            <div className='mb-6 mt-3 grid grid-cols-[auto_1fr] gap-x-1'>
                <NotebookIcon size={60} weight='thin' className='text-default-foreground row-span-2' />
                <h1 className='text-3xl font-bold'>错题本</h1>
                <p className='text-default-500 mt-1'>收录的题目笔记</p>
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
    const { data } = await getRecentQuestionNotesAction({})
    return <QuestionNotebookList initialData={data} />
}
