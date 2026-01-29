import Main from '@/components/ui/main'
import { PaperManager, PaperManagerHeader } from './components/paper-manager'
import { getPapersByCreator } from '@repo/supabase/paper'
import { getUserOrThrow } from '@repo/user'
import { Suspense } from 'react'
import { Progress } from '@heroui/progress'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: '我的试卷',
}

export default async function PaperManagerPage() {
    return (
        <Main>
            <Suspense fallback={
                <>
                    <PaperManagerHeader />
                    <Progress size='lg' isIndeterminate />
                </>}>
                <PaperManagerWrapper />
            </Suspense>
        </Main>
    )
}

async function PaperManagerWrapper() {
    const user = await getUserOrThrow()
    const papers = await getPapersByCreator({ creator: user.userId })
    return <PaperManager papers={papers} />
}