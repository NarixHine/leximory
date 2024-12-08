import { isAccessibleAndRelevantToUser } from '@/lib/auth'
import { getXataClient } from '@/lib/xata'
import moment from 'moment-timezone'
import Markdown from '@/components/markdown'
import H from '@/components/h'
import { welcomeMap } from '@/lib/config'

export default async function Report({ day }: {
    day: '今天' | '一天前' | '四天前' | '七天前'
}) {
    const range = {
        '今天': [0, -1],
        '一天前': [1, 0],
        '四天前': [4, 3],
        '七天前': [7, 6],
    }
    const xata = getXataClient()
    const words = await xata.db.lexicon.select(['id', 'word']).filter({
        $all: [
            isAccessibleAndRelevantToUser(),
            {
                'xata.createdAt': { $ge: moment().tz('Asia/Shanghai').startOf('day').subtract(range[day][0], 'day').utc().toDate() }
            },
            {
                'xata.createdAt': { $lt: moment().tz('Asia/Shanghai').startOf('day').subtract(range[day][1], 'day').utc().toDate() }
            },
            {
                'word': { $contains: '||' }
            },
            {
                $not: {
                    'word': { $any: Object.values(welcomeMap) }
                }
            }
        ]
    }).getMany({
        pagination: {
            size: 50,
        }
    })

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
