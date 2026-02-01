import { Main } from '@repo/ui/main'
import { getRecentWordsAction } from '@repo/service/word'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { Progress } from '@heroui/progress'
import { NotebookList } from './components/notebook-list'
import { BookBookmarkIcon } from '@phosphor-icons/react/ssr'

export const metadata: Metadata = {
    title: '生词本',
}

export default function Page() {
    return (
        <Main>
            <div className='mb-6 mt-3 grid grid-cols-[auto_1fr] gap-x-1'>
                <BookBookmarkIcon size={60} weight='thin' className='text-default-foreground row-span-2' />
                <h1 className='text-3xl font-bold'>生词本</h1>
                <p className='text-default-500 mt-1'>最近保存的语块</p>
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
    const { data } = await getRecentWordsAction({})
    return <NotebookList initialData={data} />
}
