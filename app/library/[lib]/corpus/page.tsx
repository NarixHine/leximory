import H from '@/components/ui/h'
import { Spacer } from "@heroui/spacer"
import Main from '@/components/ui/main'
import Recollection from './components/recollection'
import load from './actions'
import Test from './components/test'
import Nav from '@/components/nav'
import { Metadata } from 'next'
import { getLib } from '@/server/db/lib'
import { LibProps } from '@/lib/types'
import Link from 'next/link'
import { Button } from '@heroui/button'
import { PiPrinterDuotone } from 'react-icons/pi'

export const metadata: Metadata = {
    title: '语料库'
}

const getData = async (lib: string) => {
    const { words, cursor, more } = await load(lib)
    const { name } = await getLib({ id: lib })
    return { words, cursor, more, name }
}

export default async function Page(props: LibProps) {
    const params = await props.params
    const { lib } = params
    const { words, cursor, more, name } = await getData(lib)

    return (<Main className='max-w-(--breakpoint-lg)'>
        <Nav isAtCorpus lib={{ id: lib, name }}></Nav>
        <H fancy className='text-5xl'>
            {name}
        </H>
        <Spacer y={5}></Spacer>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='sm:col-span-1'>
                <Button
                    as={Link}
                    variant='flat'
                    fullWidth
                    color='primary'
                    radius='lg'
                    size='sm'
                    className='mt-2'
                    href={`/library/${lib}/corpus/print`}
                    startContent={<PiPrinterDuotone />}
                >
                    打印词卡
                </Button>
                <Test latestTime={words[0].date}></Test>
            </div>
            <div className='sm:col-span-2'>
                <Recollection words={words} cursor={cursor} more={more}></Recollection>
            </div>
        </div>
    </Main>)
}
