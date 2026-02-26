import { Article } from '@/app/library/[lib]/[text]/article'
import { getArticleData } from '@/app/library/[lib]/[text]/data'
import { ArticleSkeleton } from '@/app/library/[lib]/[text]/skeleton'
import Main from '@/components/ui/main'
import { SIGN_IN_URL } from '@repo/env/config'
import { getSession } from '@repo/user'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

type PublicTextPageProps = {
    params: Promise<{
        text: string
    }>
}

export default async function PublicTextPage(props: PublicTextPageProps) {
    return (
        <Main className='max-w-none sm:w-full pt-6 md:pt-0 px-0 md:px-0 [counter-reset:sidenote-counter] md:pb-4'>
            <Suspense fallback={<ArticleSkeleton />}>
                <PageContent {...props} />
            </Suspense>
        </Main>
    )
}

export async function PageContent({ params }: PublicTextPageProps) {
    const { text } = await params
    const { isPublicAndFree, ...data } = await getArticleData(text, false)
    if (await getSession()) {
        redirect(`/library/${data.lib.id}/${text}`)
    }
    if (!isPublicAndFree) {
        redirect(SIGN_IN_URL)
    }
    return <Article
        text={text}
        hideControls
        isPublicAndFree={isPublicAndFree}
        {...data}
    />
}
