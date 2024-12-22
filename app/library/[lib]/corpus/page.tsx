import H from '@/components/h'
import { Spacer } from '@nextui-org/spacer'
import Main from '@/components/main'
import Recollection from './recollection'
import load from './actions'
import Test from './test'
import Nav from '@/components/nav'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: '语料库'
}

export default async function Page(props: LibParams) {
    const params = await props.params
    const { lib } = params
    const { words, cursor, more } = await load(lib)

    return (<Main className='max-w-screen-lg'>
        <Nav isAtCorpus lib={{ id: lib, name: words[0].lib.name }}></Nav>
        <H useNoto>{words[0].lib.name}</H>
        <Spacer y={5}></Spacer>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='sm:col-span-1'>
                <h2 className='text-xl font-semibold opacity-80'>自我检测</h2>
                <Test latestTime={words[0].date}></Test>
            </div>
            <div className='sm:col-span-2'>
                <Recollection words={words} cursor={cursor} more={more}></Recollection>
            </div>
        </div>
    </Main>)
}
