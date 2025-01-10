import { isAccessibleAndRelevantToUser } from '@/lib/auth'
import Markdown from '@/components/markdown'
import H from '@/components/ui/h'
import { getForgetCurve } from '@/server/word'

export const forgetCurve = {
    '今天记忆': [0, -1],
    '一天前记忆': [1, 0],
    '四天前记忆': [4, 3],
    '七天前记忆': [7, 6],
}

export type ForgetCurvePoint = keyof typeof forgetCurve

export default async function Report({ day }: {
    day: ForgetCurvePoint
}) {
    const words = await getForgetCurve({ day, filter: await isAccessibleAndRelevantToUser() })

    return words.length > 0 ? (
        <div className='my-8'>
            <H disableCenter className='text-xl font-semibold opacity-80 -mb-2'>{day}</H>
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
                {words.map((word) => (
                    <Markdown key={word.id} md={word.word} asCard></Markdown>
                ))}
            </div>
        </div>
    ) : <></>
}
