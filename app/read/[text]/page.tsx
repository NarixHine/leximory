import { Article } from '@/app/library/[lib]/[text]/article'
import { getArticleData } from '@/app/library/[lib]/[text]/data'
import Main from '@/components/ui/main'
import { SIGN_IN_URL } from '@/lib/config'
import { getSession } from '@/server/auth/user'
import { redirect } from 'next/navigation'

export default async function PublicTextPage(props: { params: Promise<{ text: string }> }) {
    const { text } = await props.params
    const { isPublicAndFree, ...data } = await getArticleData(text, false)
    if (await getSession()) {
        redirect(`/library/${data.lib.id}/${text}`)
    }
    if (!isPublicAndFree) {
        redirect(SIGN_IN_URL)
    }
    return (
        <Main className='max-w-(--breakpoint-lg) [counter-reset:sidenote-counter] md:pb-4'>
            <Article
                text={text}
                hideControls
                isPublicAndFree={isPublicAndFree}
                {...data}
            />
        </Main>
    )
}
