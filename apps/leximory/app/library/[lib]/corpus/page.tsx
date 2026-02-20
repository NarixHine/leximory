import Main from '@/components/ui/main'
import Recollection from './components/recollection'
import load from './actions'
import Test from './components/test'
import { Metadata } from 'next'
import { getLib } from '@/server/db/lib'
import { LibProps } from '@/lib/types'
import { PiArrowLeft, PiBookBookmark } from 'react-icons/pi'
import { momentSH } from '@/lib/moment'
import Link from 'next/link'
import LoadingIndicatorWrapper from '@/components/ui/loading-indicator-wrapper'

export const metadata: Metadata = {
    title: '语块本'
}

const getData = async (lib: string) => {
    const [{ words, cursor, more }, { name }] = await Promise.all([
        load(lib),
        getLib({ id: lib })
    ])
    return { words, cursor, more, name }
}

export default async function Page(props: LibProps) {
    const params = await props.params
    const { lib } = params
    const { words, cursor, more, name } = await getData(lib)

    return (<Main className='max-w-(--breakpoint-lg)'>
        {/* Header — matches library detail page style */}
        <header className='mb-8'>
            <div className='flex items-center gap-2 mb-1'>
                <Link
                    href={`/library/${lib}`}
                    className='flex h-8 w-8 items-center justify-center rounded-full text-default-400 transition-colors hover:bg-default-100 hover:text-default-600'
                    aria-label='返回文库'
                >
                    <LoadingIndicatorWrapper variant='spinner'>
                        <PiArrowLeft className='size-6' />
                    </LoadingIndicatorWrapper>
                </Link>
                <PiBookBookmark className='size-5 text-default-400' />
                <span className='text-xs font-semibold tracking-widest text-default-400'>语块本</span>
            </div>
            <h1 className='font-formal text-3xl tracking-tight text-foreground'>{name}</h1>
        </header>

        <div className='grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8'>
            <div>
                <Test latestTime={words[0] ? words[0].date : momentSH().format('YYYY-MM-DD')} />
            </div>
            <div>
                <Recollection words={words} cursor={cursor} more={more} />
            </div>
        </div>
    </Main>)
}
