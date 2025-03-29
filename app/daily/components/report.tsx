import { isListed } from '@/server/auth/role'
import Markdown from '@/components/markdown'
import H from '@/components/ui/h'
import { getForgetCurve } from '@/server/db/word'
import StoryGen from './story-gen'
import { supportedLangs } from '@/lib/config'

export const forgetCurve = {
    '今天记忆': [0, -1],
    '一天前记忆': [1, 0],
    '四天前记忆': [4, 3],
    '七天前记忆': [7, 6],
    '十四天前记忆': [14, 13],
}

export type ForgetCurvePoint = keyof typeof forgetCurve

export default async function Report({ day }: {
    day: ForgetCurvePoint
}) {
    const words = await getForgetCurve({ day, filter: await isListed() })

    return words.length > 0 ? (
        <div className='my-8'>
            <div className='flex gap-3 items-start'>
                <H disableCenter className='text-xl font-semibold opacity-80 -mb-2'>{day}</H>
                {supportedLangs.filter((lang) => words.some((word) => word.lang === lang)).map((lang) => (
                    <StoryGen key={lang} comments={words.filter((word) => word.lang === lang).map(({ word }) => word)} lang={lang} />
                ))}
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {words.map((word) => (
                    <Markdown key={word.id} md={word.word} asCard shadow></Markdown>
                ))}
            </div>
        </div>
    ) : <></>
}
