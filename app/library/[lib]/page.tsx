import Main from '@/components/main'
import Nav from '@/components/nav'
import Options from '@/components/options'
import Text from '@/components/text'
import H from '@/components/h'
import { authReadToLib, authWriteToLib, authWriteToText } from '@/lib/auth'
import { randomID } from '@/lib/utils'
import { getXataClient } from '@/lib/xata'
import { Card, CardBody } from '@nextui-org/card'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { PiFilePlusDuotone } from 'react-icons/pi'

async function getData(lib: string) {
    const xata = getXataClient()
    const { rec, isReadOnly } = await authReadToLib(lib)
    const { name } = rec
    const texts = await xata.db.texts.filter({
        $all: [{ lib: { $is: lib } },]
    }).sort('xata.createdAt').select(['lib.lang', 'title', 'lib.name', 'topics']).getAll()
    return { texts, name, isReadOnly }
}

export default async function Page(props: LibParams) {
    const params = await props.params
    const { lib } = params
    const { texts, name, isReadOnly } = await getData(lib)
    const create = async (form: FormData) => {
        'use server'
        const xata = getXataClient()
        await authWriteToLib(lib)
        const { id } = await xata.db.texts.create({
            id: randomID(),
            lib,
            title: form.get('title') as string
        })
        revalidatePath('/library')
        redirect(`/library/${lib}/${id}`)
    }
    const save = async (id: string, form: FormData) => {
        'use server'
        const xata = getXataClient()
        await authWriteToText(id)
        await xata.db.texts.update(id, {
            title: form.get('title') as string
        })
        revalidatePath('/library')
    }
    const del = async (id: string) => {
        'use server'
        const xata = getXataClient()
        await authWriteToText(id)
        await xata.db.texts.delete(id)
        revalidatePath('/library')
    }

    return <Main>
        <Nav lib={{ id: lib, name }}></Nav>
        <H className='mb-10 text-5xl'>{name}</H>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
            {texts.map(({ lib, title, id, topics }) => (
                <Text
                    libId={lib!.id}
                    id={id}
                    key={id}
                    title={title}
                    lang={lib!.lang}
                    save={save.bind(null, id)}
                    del={del.bind(null, id)}
                    isReadOnly={isReadOnly}
                    topics={topics ?? []}
                ></Text>
            ))}
            <Options
                trigger={
                    isReadOnly ? <></> : <Card className='h-full w-full min-h-40 opacity-70 bg-transparent' shadow='none' isPressable>
                        <CardBody className='justify-center items-center flex'>
                            <span className='text-8xl text-slate-700 dark:text-slate-200'><PiFilePlusDuotone /></span>
                        </CardBody>
                    </Card>
                }
                action={create}
                inputs={[{
                    name: 'title',
                    label: '标题',
                    description: '可留空（通过文章链接自动填补）'
                }]}></Options>
        </div>
    </Main>
}
