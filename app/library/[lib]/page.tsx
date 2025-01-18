import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import H from '@/components/ui/h'
import Text, { AddTextButton } from './components/text'
import { authReadToLib } from '@/lib/auth'
import { getTexts } from '@/server/db/text'
import { LibParams } from '@/lib/types'

async function getData(lib: string) {
    const { name, isReadOnly } = await authReadToLib(lib)
    const texts = await getTexts({ lib })
    return { texts: texts.map(t => ({ id: t.id, title: t.title, topics: t.topics, hasEbook: !!t.ebook?.url })), name, isReadOnly }
}

export default async function Page(props: LibParams) {
    const params = await props.params
    const { lib } = params
    const { texts, name } = await getData(lib)

    return <Main>
        <Nav lib={{ id: lib, name }}></Nav>
        <H useNoto className='mb-10 text-5xl'>{name}</H>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
            {texts.map(({ title, id, topics, hasEbook }) => (
                <Text
                    id={id}
                    key={id}
                    title={title}
                    topics={topics ?? []}
                    hasEbook={hasEbook}
                ></Text>
            ))}
            <AddTextButton />
        </div>
    </Main>
}
