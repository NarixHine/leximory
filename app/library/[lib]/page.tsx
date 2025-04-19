import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import H from '@/components/ui/h'
import Text, { AddTextButton } from './components/text'
import { authReadToLib } from '@/server/auth/role'
import { getTexts } from '@/server/db/text'
import { LibParams } from '@/lib/types'

async function getData(lib: string) {
    const { name, isReadOnly, lang } = await authReadToLib(lib)
    const texts = await getTexts({ lib })
    return { texts, name, isReadOnly, lang }
}

export default async function Page(props: LibParams) {
    const params = await props.params
    const { lib } = params
    const { texts, name, isReadOnly, lang } = await getData(lib)

    return <Main>
        <Nav lib={{ id: lib, name }}></Nav>
        <H usePlayfair={lang === 'zh' || lang === 'en'} useNoto={lang === 'ja'} className='mb-10 text-5xl'>{name}</H>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
            {texts.map(({ title, id, topics, hasEbook, createdAt, updatedAt }) => (
                <Text
                    id={id}
                    key={id}
                    title={title}
                    topics={topics ?? []}
                    hasEbook={hasEbook}
                    createdAt={createdAt}
                    updatedAt={updatedAt}
                ></Text>
            ))}
            {!isReadOnly && <AddTextButton />}
        </div>
    </Main>
}
