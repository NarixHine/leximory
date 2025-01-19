import { isListed } from '@/server/auth/role'
import Markdown from '../../../components/markdown'
import { ReactNode } from 'react'
import { getRecentWords } from '@/server/db/word'
import { PiEmpty } from 'react-icons/pi'

export default async function Lookback() {
    const words = await getRecentWords({ filter: await isListed() })
    return <LookbackWrapper>
        {words.length > 0 ? words.map(({ word, id }) =>
            <span key={id} className='inline-block px-2 py-1'>
                <Markdown key={word} md={word} disableSave></Markdown>
            </span>
        ) : <span className={'inline-block px-2 py-1'}>
            <span className='flex items-center gap-1'>
                <PiEmpty />
                <Markdown md={'暂无新增语汇'}></Markdown>
            </span>
        </span>}
    </LookbackWrapper>
}

export const LookbackWrapper = ({ children }: { children: ReactNode }) => {
    return <div className='-mb-7 -mt-8'>
        <div className='w-full overflow-x-auto whitespace-nowrap border-b-2'>
            {children}
        </div>
        <label className='p-2 opacity-70 font-semibold'>近期回顾</label>
    </div>
}
