import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import { getTextContent } from '@/server/db/text'
import { LibAndTextProps } from '@/lib/types'
import { getArticleData } from './data'
import { Article } from './article'

export async function generateMetadata(props: LibAndTextProps) {
    const params = await props.params
    const { title } = await getTextContent({ id: params.text })
    return {
        title: typeof title === 'string' && title !== '' ? title : '新文本'
    }
}

export default async function Page(props: LibAndTextProps) {
    const { text } = await props.params
    const data = await getArticleData(text)
    return (<Main className='max-w-(--breakpoint-lg) [counter-reset:sidenote-counter] md:pb-4'>
        <Nav lib={{ id: data.lib.id, name: data.lib.name }} text={{ id: text, name: data.title }}></Nav>
        <Article {...data} text={text} />
    </Main>)
}
