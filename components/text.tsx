'use client'

import { Card, CardBody, CardFooter, Chip } from '@nextui-org/react'
import Options from './options'
import { useRouter } from 'next/navigation'
import { stringToColor } from '@/lib/utils'
import { postFontFamily } from '@/lib/fonts'

function Text({ id, title, save, del, libId, isReadOnly, topics }: {
    id: string,
    title: string,
    lang: string,
    save: (form: FormData) => void,
    del?: () => Promise<void>
    libId: string
    isReadOnly: boolean
    topics: string[]
}) {
    const router = useRouter()
    return (<div className='w-full h-full relative'>
        <Card shadow='sm' fullWidth className='h-full' isPressable onPress={() => {
            router.push(`/library/${libId}/${id}`)
        }}>
            <CardBody className='p-7'>
                <a className='text-2xl text-balance' style={{
                    fontFamily: postFontFamily
                }}>{title}</a>
            </CardBody>
            <CardFooter className='p-7'>
                <div className='gap-2 flex flex-wrap align-middle items-center'>
                    {topics.map(topic => <Chip key={topic} variant='flat' color={stringToColor(topic)}>{topic}</Chip>)}
                </div>
            </CardFooter>
        </Card>
        {!isReadOnly && <Options
            del={del}
            action={save}
            inputs={[{
                name: 'title',
                label: '标题',
                value: title
            }]}></Options>}
    </div>)
}

export default Text
