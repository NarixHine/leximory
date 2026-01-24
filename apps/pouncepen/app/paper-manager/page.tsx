import Main from '@/components/ui/main'
import { PaperManager, PaperManagerHeader } from './components/paper-manager/dashboard'
import { getPapersByCreator } from '@repo/supabase/paper'
import { getUserOrThrow } from '@repo/user'
import { Suspense } from 'react'
import { Progress } from '@heroui/progress'

export default async function PaperManagerPage() {
    return (
        <Main>
            <Suspense fallback={
                <>
                    <PaperManagerHeader />
                    <Progress isIndeterminate />
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