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
        <H useSerif>{words[0].lib.name}</H>
        <Spacer y={5}></Spacer>
        <div className='flex flex-col space-y-6 sm:flex-row sm:space-x-5'>
            <div className='basis-1/3 sm:border-r-1 sm:pr-2'>
                <h2 className='text-xl font-semibold'>自我检测</h2>
                <Test latestTime={words[0].xata.createdAt.toISOString().split('T')[0]}></Test>
            </div>
            <div className='basis-3/5'>
                <Recollection words={words} cursor={cursor} more={more}></Recollection>
            </div>
        </div>
    </Main>)
}
