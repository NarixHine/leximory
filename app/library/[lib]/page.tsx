import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import H from '@/components/ui/h'
import Text, { AddTextButton } from './components/text'
import { authReadToLib } from '@/server/auth/role'
import { getTexts } from '@/server/db/text'
import { LibParams } from '@/lib/types'
import { Button } from '@heroui/button'
import { PiBookOpen } from 'react-icons/pi'
import Link from 'next/link'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { cn } from '@/lib/utils'

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
        <H usePlayfair={lang === 'zh' || lang === 'en'} useNoto={lang === 'ja'} className='mb-4 text-5xl'>{name}</H>
        <div className='flex justify-center mb-5'>
            <Button variant='light' startContent={<PiBookOpen />} className={cn(CHINESE_ZCOOL.className)} as={Link} href={`/library/${lib}/all-of-it`}>
                打印所有文章
            </Button>
        </div>
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
